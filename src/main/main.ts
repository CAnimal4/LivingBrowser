import { app, BrowserWindow, DownloadItem, ipcMain, Rectangle, session, WebContents, WebContentsView } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MockAiProvider } from "./ai-provider.js";
import { TrackerBlocker } from "./blocklist.js";
import { LivingStore } from "./storage.js";
import { TabManager } from "./tab-manager.js";
import type { AiAction, AppSettings, AppState, BrowserMode, BrowserTab, SiteDataSummary } from "../shared/types.js";
import { isInternalUrl, normalizeUrl, originFromUrl } from "../shared/url.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, "../renderer/index.html")}`;
const riskyPermissions = new Set(["media", "geolocation", "notifications", "midiSysex", "pointerLock", "fullscreen", "openExternal"]);
const configuredSessions = new WeakSet<Electron.Session>();

let mainWindow: BrowserWindow | null = null;
let store: LivingStore;
let activeGoalId: string | null = null;
let currentLayout: Rectangle = { x: 282, y: 86, width: 720, height: 600 };

const tabs = new TabManager();
const views = new Map<string, WebContentsView>();
const blocker = new TrackerBlocker();
const ai = new MockAiProvider();

function dataDir(): string {
  const dir = process.env.LIVING_BROWSER_DATA_DIR || process.env.LIVING_BROWSER_TEST_DATA_DIR || app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSettings(): AppSettings {
  return store.getSettings();
}

function tabSession(tab: BrowserTab): Electron.Session {
  const partition = tab.isPrivate ? `living-private-${tab.id}` : "persist:living-browser";
  const ses = session.fromPartition(partition);
  configureSession(ses);
  return ses;
}

function configureSession(ses: Electron.Session): void {
  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);

  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const origin = details.requestingUrl ? originFromUrl(details.requestingUrl) : "unknown";
    const saved = store.getPermission(origin, permission);
    if (saved?.decision === "allow" && !riskyPermissions.has(permission)) {
      callback(true);
      return;
    }
    callback(saved?.decision === "allow" && permission === "notifications" ? true : false);
  });

  ses.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
    const settings = getSettings();
    if (settings.localOnlyMode) {
      store.recordBlocked(null, details.url, details.referrer || null);
      callback({ cancel: true });
      return;
    }
    if (settings.blockAdsAndTrackers && blocker.shouldBlock(details.url)) {
      const active = tabs.active();
      store.recordBlocked(active?.id ?? null, details.url, active?.url ?? details.referrer ?? null);
      if (active) {
        const count = store.getBlockedCount(active.id);
        tabs.update(active.id, { blockedTrackers: count, privacyScore: Math.max(35, 100 - count * 7) });
        broadcastState();
      }
      callback({ cancel: true });
      return;
    }
    callback({});
  });

  ses.on("will-download", (_event, item: DownloadItem) => {
    const id = store.addDownload(item.getURL(), item.getFilename());
    item.once("done", (_doneEvent, state) => {
      store.updateDownload(id, state);
      broadcastState();
    });
  });
}

function createView(tab: BrowserTab): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      session: tabSession(tab)
    }
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    void createTab({ url, mode: tab.mode, private: tab.isPrivate });
    return { action: "deny" };
  });

  view.webContents.on("did-start-loading", () => {
    tabs.update(tab.id, { loading: true });
    broadcastState();
  });

  view.webContents.on("did-stop-loading", () => {
    tabs.update(tab.id, { loading: false, canGoBack: view.webContents.canGoBack(), canGoForward: view.webContents.canGoForward() });
    broadcastState();
  });

  view.webContents.on("did-navigate", (_event, url) => updateTabFromWebContents(tab.id, view.webContents, url));
  view.webContents.on("did-navigate-in-page", (_event, url) => updateTabFromWebContents(tab.id, view.webContents, url));
  view.webContents.on("page-title-updated", (_event, title) => {
    tabs.update(tab.id, { title: title || tabs.get(tab.id)?.url || "Untitled" });
    broadcastState();
  });
  view.webContents.on("did-fail-load", (_event, _code, description, validatedUrl) => {
    tabs.update(tab.id, { title: `Load failed: ${description}`, url: validatedUrl || tab.url, loading: false });
    broadcastState();
  });

  return view;
}

function updateTabFromWebContents(tabId: string, webContents: WebContents, url: string): void {
  const tab = tabs.get(tabId);
  if (!tab) return;
  const title = webContents.getTitle() || url;
  tabs.update(tabId, {
    url,
    title,
    canGoBack: webContents.canGoBack(),
    canGoForward: webContents.canGoForward(),
    lastActiveAt: Date.now()
  });
  store.recordVisit(url, title, tab.goalId, tab.isPrivate, 30);
  saveSession();
  broadcastState();
}

async function createTab(options: { url?: string; mode?: BrowserMode; private?: boolean } = {}): Promise<AppState> {
  const tab = tabs.create({
    url: options.url ? normalizeUrl(options.url) : "living://start",
    goalId: activeGoalId,
    mode: options.mode ?? getSettings().defaultMode,
    isPrivate: options.private ?? false
  });
  if (tab.url && !isInternalUrl(tab.url)) {
    const view = createView(tab);
    views.set(tab.id, view);
    await view.webContents.loadURL(tab.url);
  }
  attachActiveView();
  saveSession();
  return broadcastState();
}

function attachActiveView(): void {
  if (!mainWindow) return;
  for (const view of views.values()) {
    try {
      mainWindow.contentView.removeChildView(view);
    } catch {
      // Ignore detached views.
    }
  }
  const active = tabs.active();
  if (!active || isInternalUrl(active.url)) return;
  let view = views.get(active.id);
  if (!view) {
    view = createView(active);
    views.set(active.id, view);
    void view.webContents.loadURL(active.url);
  }
  mainWindow.contentView.addChildView(view);
  view.setBounds(currentLayout);
}

function saveSession(): void {
  store.saveSession(tabs.all(), tabs.activeTabId, activeGoalId);
}

function appState(): AppState {
  return {
    tabs: tabs.all(),
    activeTabId: tabs.activeTabId,
    goals: store.listGoals(),
    activeGoalId,
    settings: getSettings(),
    bookmarks: store.listBookmarks(),
    stats: store.stats(tabs.all().length)
  };
}

function broadcastState(): AppState {
  const state = appState();
  mainWindow?.webContents.send("app:state", state);
  return state;
}

async function activePageText(tabId?: string): Promise<string> {
  const id = tabId ?? tabs.activeTabId;
  if (!id) return "";
  const view = views.get(id);
  if (!view) return "";
  return view.webContents.executeJavaScript(`
    (() => {
      const selection = String(window.getSelection ? window.getSelection() : "");
      const text = document.body ? document.body.innerText : "";
      return JSON.stringify({ selection, text: text.slice(0, 24000) });
    })()
  `).then((json) => {
    const parsed = JSON.parse(json) as { selection: string; text: string };
    return parsed.selection || parsed.text;
  }).catch(() => "");
}

async function selectionText(tabId?: string): Promise<string> {
  const id = tabId ?? tabs.activeTabId;
  if (!id) return "";
  const view = views.get(id);
  if (!view) return "";
  return view.webContents.executeJavaScript("String(window.getSelection ? window.getSelection() : '')").catch(() => "");
}

async function siteDataFor(tabId: string): Promise<SiteDataSummary> {
  const tab = tabs.get(tabId);
  const origin = tab ? originFromUrl(tab.url) : "unknown";
  const view = views.get(tabId);
  const ses = view?.webContents.session ?? session.defaultSession;
  const cookies = origin === "unknown" ? [] : await ses.cookies.get({ url: origin }).catch(() => []);
  return {
    origin,
    cookies: cookies.length,
    permissions: store.listPermissions(origin)
  };
}

function registerIpc(): void {
  ipcMain.handle("app:getState", () => appState());
  ipcMain.handle("layout:update", (_event, bounds: Rectangle) => {
    currentLayout = bounds;
    attachActiveView();
  });
  ipcMain.handle("tabs:new", (_event, options) => createTab(options ?? {}));
  ipcMain.handle("tabs:select", (_event, id: string) => {
    tabs.select(id);
    attachActiveView();
    saveSession();
    return broadcastState();
  });
  ipcMain.handle("tabs:close", (_event, id: string) => {
    const view = views.get(id);
    if (view && mainWindow) {
      try {
        mainWindow.contentView.removeChildView(view);
      } catch {
        // Ignore detached views.
      }
      view.webContents.close();
      views.delete(id);
    }
    tabs.close(id);
    attachActiveView();
    saveSession();
    return broadcastState();
  });
  ipcMain.handle("tabs:navigate", async (_event, tabId: string, input: string) => {
    const tab = tabs.get(tabId);
    if (!tab) return appState();
    const url = normalizeUrl(input);
    if (getSettings().localOnlyMode && !isInternalUrl(url)) {
      tabs.update(tabId, { title: "Local-only mode blocked navigation", url: tab.url });
      return broadcastState();
    }
    tabs.update(tabId, { url, title: url, loading: !isInternalUrl(url), lastActiveAt: Date.now() });
    if (isInternalUrl(url)) {
      attachActiveView();
      saveSession();
      return broadcastState();
    }
    let view = views.get(tabId);
    if (!view) {
      view = createView(tabs.get(tabId)!);
      views.set(tabId, view);
    }
    attachActiveView();
    await view.webContents.loadURL(url);
    saveSession();
    return broadcastState();
  });
  ipcMain.handle("tabs:back", (_event, tabId: string) => views.get(tabId)?.webContents.goBack());
  ipcMain.handle("tabs:forward", (_event, tabId: string) => views.get(tabId)?.webContents.goForward());
  ipcMain.handle("tabs:reload", (_event, tabId: string) => views.get(tabId)?.webContents.reload());
  ipcMain.handle("bookmarks:toggle", (_event, tabId: string) => {
    const tab = tabs.get(tabId);
    return tab ? store.toggleBookmark(tab.url, tab.title) : store.listBookmarks();
  });
  ipcMain.handle("history:list", (_event, query?: string) => (query ? store.searchHistory(query) : store.listHistory()));
  ipcMain.handle("history:clear", () => {
    store.clearHistory();
    return broadcastState();
  });
  ipcMain.handle("downloads:list", () => store.listDownloads());
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:save", (_event, settings: AppSettings) => {
    store.setSetting("settings", settings);
    return broadcastState();
  });
  ipcMain.handle("privacy:siteData", (_event, tabId: string) => siteDataFor(tabId));
  ipcMain.handle("privacy:nukeSiteData", async (_event, tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab) return siteDataFor(tabId);
    const view = views.get(tabId);
    const origin = originFromUrl(tab.url);
    await (view?.webContents.session ?? session.defaultSession).clearStorageData({
      origin,
      storages: ["cookies", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers", "cachestorage"]
    });
    return siteDataFor(tabId);
  });
  ipcMain.handle("privacy:setPermission", (_event, origin: string, permission: string, decision: "allow" | "deny" | "ask") => {
    store.setPermission(origin, permission, decision);
    return { origin, cookies: 0, permissions: store.listPermissions(origin) } satisfies SiteDataSummary;
  });
  ipcMain.handle("ai:run", async (_event, action: AiAction) => {
    const active = tabs.active();
    const goal = active?.goalId ? store.listGoals().find((item) => item.id === active.goalId) ?? null : null;
    const openTabs = await Promise.all(tabs.all().map(async (tab) => ({ title: tab.title, url: tab.url, text: await activePageText(tab.id) })));
    const result = await ai.run({
      action,
      pageText: await activePageText(),
      selectionText: await selectionText(),
      goal,
      tabs: openTabs
    });
    store.recordAi(result, active?.url ?? null, active?.goalId ?? null);
    broadcastState();
    return result;
  });
  ipcMain.handle("goals:create", (_event, title: string, mode: BrowserMode) => {
    const goal = store.createGoal(title || "Untitled goal", mode);
    activeGoalId = goal.id;
    const active = tabs.active();
    if (active) tabs.update(active.id, { goalId: goal.id, mode });
    saveSession();
    return broadcastState();
  });
  ipcMain.handle("goals:complete", (_event, id: string) => {
    store.completeGoal(id);
    if (activeGoalId === id) activeGoalId = null;
    saveSession();
    return broadcastState();
  });
  ipcMain.handle("goals:export", (_event, goalId?: string | null) => store.sessionReport(goalId ?? activeGoalId, tabs.all().length));
  ipcMain.handle("memory:rememberPage", (_event, tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab) throw new Error("Unknown tab");
    return store.rememberPage(tab.url, tab.title, tab.goalId);
  });
  ipcMain.handle("memory:addNote", (_event, tabId: string, text: string) => {
    const tab = tabs.get(tabId);
    if (!tab) throw new Error("Unknown tab");
    return store.addNote(tab.url, tab.title, text);
  });
  ipcMain.handle("memory:addHighlight", (_event, tabId: string, text: string, note?: string) => {
    const tab = tabs.get(tabId);
    if (!tab) throw new Error("Unknown tab");
    return store.addHighlight(tab.url, tab.title, text, note);
  });
  ipcMain.handle("memory:search", (_event, query: string) => store.searchMemory(query ?? ""));
  ipcMain.handle("stats:get", () => store.stats(tabs.all().length));
  ipcMain.handle("stats:weeklyReport", () => store.weeklyReport(tabs.all().length));
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    title: "Living Browser",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.on("resize", attachActiveView);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(rendererUrl);
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  store = new LivingStore(LivingStore.pathFor(dataDir()));
  const restored = store.getSession();
  if (restored?.tabs.length) {
    activeGoalId = restored.activeGoalId;
    tabs.restore(restored.tabs, restored.activeTabId);
  } else {
    tabs.create({ url: "living://start", mode: getSettings().defaultMode });
  }
  registerIpc();
  await createMainWindow();
  for (const tab of tabs.all()) {
    if (!isInternalUrl(tab.url)) {
      const view = createView(tab);
      views.set(tab.id, view);
      void view.webContents.loadURL(tab.url);
    }
  }
  attachActiveView();
  broadcastState();
}

app.on("window-all-closed", () => {
  saveSession();
  store.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
});

void bootstrap();

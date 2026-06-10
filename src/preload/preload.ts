import { contextBridge, ipcRenderer } from "electron";
import type { LivingApi } from "../types/living-api.js";

const api: LivingApi = {
  getState: () => ipcRenderer.invoke("app:getState"),
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: Awaited<ReturnType<LivingApi["getState"]>>) => callback(state);
    ipcRenderer.on("app:state", listener);
    return () => ipcRenderer.removeListener("app:state", listener);
  },
  updateLayout: (bounds) => ipcRenderer.invoke("layout:update", bounds),
  newTab: (options) => ipcRenderer.invoke("tabs:new", options),
  selectTab: (id) => ipcRenderer.invoke("tabs:select", id),
  closeTab: (id) => ipcRenderer.invoke("tabs:close", id),
  navigate: (tabId, url) => ipcRenderer.invoke("tabs:navigate", tabId, url),
  goBack: (tabId) => ipcRenderer.invoke("tabs:back", tabId),
  goForward: (tabId) => ipcRenderer.invoke("tabs:forward", tabId),
  reload: (tabId) => ipcRenderer.invoke("tabs:reload", tabId),
  toggleBookmark: (tabId) => ipcRenderer.invoke("bookmarks:toggle", tabId),
  listHistory: (query) => ipcRenderer.invoke("history:list", query),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  listDownloads: () => ipcRenderer.invoke("downloads:list"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  siteData: (tabId) => ipcRenderer.invoke("privacy:siteData", tabId),
  nukeSiteData: (tabId) => ipcRenderer.invoke("privacy:nukeSiteData", tabId),
  setPermission: (origin, permission, decision) => ipcRenderer.invoke("privacy:setPermission", origin, permission, decision),
  runAi: (action) => ipcRenderer.invoke("ai:run", action),
  createGoal: (title, mode) => ipcRenderer.invoke("goals:create", title, mode),
  completeGoal: (id) => ipcRenderer.invoke("goals:complete", id),
  exportSessionReport: (goalId) => ipcRenderer.invoke("goals:export", goalId),
  rememberPage: (tabId) => ipcRenderer.invoke("memory:rememberPage", tabId),
  addNote: (tabId, text) => ipcRenderer.invoke("memory:addNote", tabId, text),
  addHighlight: (tabId, text, note) => ipcRenderer.invoke("memory:addHighlight", tabId, text, note),
  searchMemory: (query) => ipcRenderer.invoke("memory:search", query),
  stats: () => ipcRenderer.invoke("stats:get"),
  weeklyReport: () => ipcRenderer.invoke("stats:weeklyReport")
};

contextBridge.exposeInMainWorld("living", api);

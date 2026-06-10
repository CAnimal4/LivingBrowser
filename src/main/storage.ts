import Database from "better-sqlite3";
import path from "node:path";
import type {
  AiResult,
  AppSettings,
  Bookmark,
  BrowserTab,
  DownloadRecord,
  Goal,
  HistoryVisit,
  MemoryItem,
  SessionReport,
  SitePermission,
  StatsDashboard
} from "../shared/types.js";
import { domainFromUrl } from "../shared/url.js";
import { createId } from "./id.js";

const defaultSettings: AppSettings = {
  historyRetentionDays: 30,
  localOnlyMode: false,
  blockAdsAndTrackers: true,
  defaultMode: "focus"
};

export class LivingStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        domain TEXT NOT NULL,
        remembered INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        goal_id TEXT
      );
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        domain TEXT NOT NULL,
        goal_id TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        private INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        provider TEXT NOT NULL,
        url TEXT,
        goal_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        bullets TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS blocked_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tab_id TEXT,
        url TEXT NOT NULL,
        domain TEXT NOT NULL,
        page_url TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS site_permissions (
        origin TEXT NOT NULL,
        permission TEXT NOT NULL,
        decision TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (origin, permission)
      );
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        filename TEXT NOT NULL,
        state TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER
      );
    `);
    this.setSetting("settings", { ...defaultSettings, ...this.getSettings() });
  }

  getSettings(): AppSettings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get("settings") as { value: string } | undefined;
    return row ? { ...defaultSettings, ...JSON.parse(row.value) } : defaultSettings;
  }

  setSetting(key: "settings", value: AppSettings): void {
    this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
  }

  saveSession(tabs: BrowserTab[], activeTabId: string | null, activeGoalId: string | null): void {
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run("session", JSON.stringify({ tabs, activeTabId, activeGoalId }));
  }

  getSession(): { tabs: BrowserTab[]; activeTabId: string | null; activeGoalId: string | null } | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get("session") as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  createGoal(title: string, mode: Goal["mode"]): Goal {
    const goal: Goal = {
      id: createId("goal"),
      title,
      mode,
      status: "active",
      createdAt: Date.now(),
      completedAt: null
    };
    this.db
      .prepare("INSERT INTO goals (id, title, mode, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(goal.id, goal.title, goal.mode, goal.status, goal.createdAt, goal.completedAt);
    return goal;
  }

  completeGoal(id: string): void {
    this.db.prepare("UPDATE goals SET status = 'completed', completed_at = ? WHERE id = ?").run(Date.now(), id);
  }

  listGoals(): Goal[] {
    const rows = this.db.prepare("SELECT * FROM goals ORDER BY created_at DESC").all() as any[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      mode: row.mode,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));
  }

  upsertPage(url: string, title: string, goalId: string | null, remembered = false): number {
    const now = Date.now();
    const domain = domainFromUrl(url);
    this.db
      .prepare(
        `INSERT INTO pages (url, title, domain, remembered, created_at, last_seen, goal_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET title = excluded.title, domain = excluded.domain, last_seen = excluded.last_seen, goal_id = excluded.goal_id, remembered = MAX(remembered, excluded.remembered)`
      )
      .run(url, title, domain, remembered ? 1 : 0, now, now, goalId);
    const row = this.db.prepare("SELECT id FROM pages WHERE url = ?").get(url) as { id: number };
    return row.id;
  }

  recordVisit(url: string, title: string, goalId: string | null, isPrivate: boolean, durationSeconds = 0): void {
    if (isPrivate) return;
    const pageId = this.upsertPage(url, title, goalId);
    const now = Date.now();
    this.db
      .prepare("INSERT INTO visits (page_id, url, title, domain, goal_id, started_at, ended_at, duration_seconds, private) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(pageId, url, title, domainFromUrl(url), goalId, now, now, durationSeconds, isPrivate ? 1 : 0);
  }

  listHistory(limit = 300): HistoryVisit[] {
    const cutoff = Date.now() - this.getSettings().historyRetentionDays * 86400000;
    this.db.prepare("DELETE FROM visits WHERE private = 0 AND started_at < ?").run(cutoff);
    const rows = this.db.prepare("SELECT * FROM visits WHERE private = 0 ORDER BY started_at DESC LIMIT ?").all(limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      domain: row.domain,
      goalId: row.goal_id,
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      private: Boolean(row.private)
    }));
  }

  searchHistory(query: string): HistoryVisit[] {
    const like = `%${query}%`;
    const rows = this.db
      .prepare("SELECT * FROM visits WHERE private = 0 AND (title LIKE ? OR url LIKE ? OR domain LIKE ?) ORDER BY started_at DESC LIMIT 100")
      .all(like, like, like) as any[];
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      domain: row.domain,
      goalId: row.goal_id,
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      private: Boolean(row.private)
    }));
  }

  clearHistory(): void {
    this.db.prepare("DELETE FROM visits").run();
  }

  toggleBookmark(url: string, title: string): Bookmark[] {
    const existing = this.db.prepare("SELECT id FROM bookmarks WHERE url = ?").get(url);
    if (existing) {
      this.db.prepare("DELETE FROM bookmarks WHERE url = ?").run(url);
    } else {
      this.db.prepare("INSERT INTO bookmarks (url, title, created_at) VALUES (?, ?, ?)").run(url, title, Date.now());
    }
    return this.listBookmarks();
  }

  listBookmarks(): Bookmark[] {
    const rows = this.db.prepare("SELECT * FROM bookmarks ORDER BY created_at DESC").all() as any[];
    return rows.map((row) => ({ id: row.id, url: row.url, title: row.title, createdAt: row.created_at }));
  }

  rememberPage(url: string, title: string, goalId: string | null): MemoryItem {
    const pageId = this.upsertPage(url, title, goalId, true);
    return { id: pageId, url, title, type: "page", text: "Remembered page", createdAt: Date.now() };
  }

  addHighlight(url: string, title: string, text: string, note = ""): MemoryItem {
    const pageId = this.upsertPage(url, title, null, true);
    const info = this.db
      .prepare("INSERT INTO highlights (page_id, url, title, text, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(pageId, url, title, text, note, Date.now());
    return { id: Number(info.lastInsertRowid), url, title, type: "highlight", text, createdAt: Date.now() };
  }

  addNote(url: string, title: string, text: string): MemoryItem {
    const pageId = this.upsertPage(url, title, null, true);
    const now = Date.now();
    const info = this.db.prepare("INSERT INTO notes (page_id, url, title, text, created_at) VALUES (?, ?, ?, ?, ?)").run(pageId, url, title, text, now);
    return { id: Number(info.lastInsertRowid), url, title, type: "note", text, createdAt: now };
  }

  searchMemory(query: string): MemoryItem[] {
    const like = `%${query}%`;
    const pages = this.db
      .prepare("SELECT id, url, title, created_at FROM pages WHERE remembered = 1 AND (title LIKE ? OR url LIKE ?) ORDER BY last_seen DESC LIMIT 80")
      .all(like, like) as any[];
    const highlights = this.db
      .prepare("SELECT id, url, title, text, created_at FROM highlights WHERE text LIKE ? OR note LIKE ? OR title LIKE ? ORDER BY created_at DESC LIMIT 80")
      .all(like, like, like) as any[];
    const notes = this.db
      .prepare("SELECT id, url, title, text, created_at FROM notes WHERE text LIKE ? OR title LIKE ? ORDER BY created_at DESC LIMIT 80")
      .all(like, like) as any[];
    return [
      ...pages.map((row) => ({ id: row.id, url: row.url, title: row.title, type: "page" as const, text: "Remembered page", createdAt: row.created_at })),
      ...highlights.map((row) => ({ id: row.id, url: row.url, title: row.title, type: "highlight" as const, text: row.text, createdAt: row.created_at })),
      ...notes.map((row) => ({ id: row.id, url: row.url, title: row.title, type: "note" as const, text: row.text, createdAt: row.created_at }))
    ].sort((a, b) => b.createdAt - a.createdAt);
  }

  recordAi(result: AiResult, url: string | null, goalId: string | null): void {
    this.db
      .prepare("INSERT INTO ai_actions (action, provider, url, goal_id, title, body, bullets, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(result.action, result.provider, url, goalId, result.title, result.body, JSON.stringify(result.bullets), result.createdAt);
  }

  listAiActions(goalId?: string | null): AiResult[] {
    const rows = goalId
      ? (this.db.prepare("SELECT * FROM ai_actions WHERE goal_id = ? ORDER BY created_at DESC").all(goalId) as any[])
      : (this.db.prepare("SELECT * FROM ai_actions ORDER BY created_at DESC LIMIT 200").all() as any[]);
    return rows.map((row) => ({
      action: row.action,
      provider: row.provider,
      title: row.title,
      body: row.body,
      bullets: JSON.parse(row.bullets),
      createdAt: row.created_at
    }));
  }

  recordBlocked(tabId: string | null, url: string, pageUrl: string | null): void {
    this.db.prepare("INSERT INTO blocked_events (tab_id, url, domain, page_url, created_at) VALUES (?, ?, ?, ?, ?)").run(tabId, url, domainFromUrl(url), pageUrl, Date.now());
  }

  getBlockedCount(tabId?: string): number {
    const row = tabId
      ? (this.db.prepare("SELECT COUNT(*) AS count FROM blocked_events WHERE tab_id = ?").get(tabId) as { count: number })
      : (this.db.prepare("SELECT COUNT(*) AS count FROM blocked_events").get() as { count: number });
    return row.count;
  }

  setPermission(origin: string, permission: string, decision: SitePermission["decision"]): void {
    this.db
      .prepare("INSERT INTO site_permissions (origin, permission, decision, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(origin, permission) DO UPDATE SET decision = excluded.decision, updated_at = excluded.updated_at")
      .run(origin, permission, decision, Date.now());
  }

  getPermission(origin: string, permission: string): SitePermission | null {
    const row = this.db.prepare("SELECT * FROM site_permissions WHERE origin = ? AND permission = ?").get(origin, permission) as any;
    return row ? { origin: row.origin, permission: row.permission, decision: row.decision, updatedAt: row.updated_at } : null;
  }

  listPermissions(origin?: string): SitePermission[] {
    const rows = origin
      ? (this.db.prepare("SELECT * FROM site_permissions WHERE origin = ? ORDER BY permission").all(origin) as any[])
      : (this.db.prepare("SELECT * FROM site_permissions ORDER BY origin, permission").all() as any[]);
    return rows.map((row) => ({ origin: row.origin, permission: row.permission, decision: row.decision, updatedAt: row.updated_at }));
  }

  addDownload(url: string, filename: string): number {
    const info = this.db.prepare("INSERT INTO downloads (url, filename, state, started_at) VALUES (?, ?, 'progressing', ?)").run(url, filename, Date.now());
    return Number(info.lastInsertRowid);
  }

  updateDownload(id: number, state: string): void {
    this.db.prepare("UPDATE downloads SET state = ?, completed_at = ? WHERE id = ?").run(state, Date.now(), id);
  }

  listDownloads(): DownloadRecord[] {
    const rows = this.db.prepare("SELECT * FROM downloads ORDER BY started_at DESC LIMIT 200").all() as any[];
    return rows.map((row) => ({ id: row.id, url: row.url, filename: row.filename, state: row.state, startedAt: row.started_at, completedAt: row.completed_at }));
  }

  stats(tabCount = 0): StatsDashboard {
    const timePerSite = this.db.prepare("SELECT domain, SUM(duration_seconds) AS seconds FROM visits WHERE private = 0 GROUP BY domain ORDER BY seconds DESC LIMIT 12").all() as any[];
    const timePerGoal = this.db
      .prepare(
        `SELECT visits.goal_id AS goalId, COALESCE(goals.title, 'Unguided') AS title, SUM(visits.duration_seconds) AS seconds
         FROM visits LEFT JOIN goals ON visits.goal_id = goals.id
         WHERE visits.private = 0 GROUP BY visits.goal_id ORDER BY seconds DESC LIMIT 12`
      )
      .all() as any[];
    const topSites = this.db.prepare("SELECT domain, COUNT(*) AS visits FROM visits WHERE private = 0 GROUP BY domain ORDER BY visits DESC LIMIT 12").all() as any[];
    const completedSessions = (this.db.prepare("SELECT COUNT(*) AS count FROM goals WHERE status = 'completed'").get() as { count: number }).count;
    const savedPages = (this.db.prepare("SELECT COUNT(*) AS count FROM pages WHERE remembered = 1").get() as { count: number }).count;
    const highlights = (this.db.prepare("SELECT COUNT(*) AS count FROM highlights").get() as { count: number }).count;
    const notes = (this.db.prepare("SELECT COUNT(*) AS count FROM notes").get() as { count: number }).count;
    const blockedTrackers = (this.db.prepare("SELECT COUNT(*) AS count FROM blocked_events").get() as { count: number }).count;
    const aiActionsUsed = (this.db.prepare("SELECT COUNT(*) AS count FROM ai_actions").get() as { count: number }).count;
    return {
      timePerSite: timePerSite.map((row) => ({ domain: row.domain, seconds: row.seconds ?? 0 })),
      timePerGoal: timePerGoal.map((row) => ({ goalId: row.goalId, title: row.title, seconds: row.seconds ?? 0 })),
      topSites: topSites.map((row) => ({ domain: row.domain, visits: row.visits })),
      tabCount,
      completedSessions,
      savedMemories: savedPages + highlights + notes,
      blockedTrackers,
      aiActionsUsed
    };
  }

  weeklyReport(tabCount = 0): string {
    const stats = this.stats(tabCount);
    const top = stats.topSites.map((site) => `- ${site.domain}: ${site.visits} visits`).join("\n") || "- No browsing history yet";
    return `# Weekly Internet-Life Report

Generated locally on ${new Date().toLocaleString()}.

## Top sites
${top}

## Activity
- Open tabs: ${stats.tabCount}
- Completed goal sessions: ${stats.completedSessions}
- Saved memories: ${stats.savedMemories}
- Blocked trackers: ${stats.blockedTrackers}
- AI actions used: ${stats.aiActionsUsed}
`;
  }

  sessionReport(goalId: string | null, tabCount = 0): SessionReport {
    const goal = goalId ? this.listGoals().find((item) => item.id === goalId) ?? null : null;
    const visits = goalId ? this.listHistory(1000).filter((visit) => visit.goalId === goalId) : this.listHistory(1000);
    const memories = this.searchMemory("");
    return {
      goal,
      visits,
      memories,
      aiActions: this.listAiActions(goalId),
      stats: this.stats(tabCount),
      generatedAt: Date.now()
    };
  }

  static pathFor(baseDir: string): string {
    return path.join(baseDir, "living-browser.sqlite");
  }
}

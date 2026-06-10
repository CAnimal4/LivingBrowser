import type {
  AiAction,
  AiResult,
  AppSettings,
  AppState,
  Bookmark,
  BrowserMode,
  DownloadRecord,
  HistoryVisit,
  MemoryItem,
  SessionReport,
  SiteDataSummary,
  StatsDashboard
} from "../shared/types.js";

export interface LivingApi {
  getState(): Promise<AppState>;
  onState(callback: (state: AppState) => void): () => void;
  updateLayout(bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  newTab(options?: { url?: string; private?: boolean; mode?: BrowserMode }): Promise<AppState>;
  selectTab(id: string): Promise<AppState>;
  closeTab(id: string): Promise<AppState>;
  navigate(tabId: string, url: string): Promise<AppState>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string): Promise<void>;
  toggleBookmark(tabId: string): Promise<Bookmark[]>;
  listHistory(query?: string): Promise<HistoryVisit[]>;
  clearHistory(): Promise<void>;
  listDownloads(): Promise<DownloadRecord[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppState>;
  siteData(tabId: string): Promise<SiteDataSummary>;
  nukeSiteData(tabId: string): Promise<SiteDataSummary>;
  setPermission(origin: string, permission: string, decision: "allow" | "deny" | "ask"): Promise<SiteDataSummary>;
  runAi(action: AiAction): Promise<AiResult>;
  createGoal(title: string, mode: BrowserMode): Promise<AppState>;
  completeGoal(id: string): Promise<AppState>;
  exportSessionReport(goalId?: string | null): Promise<SessionReport>;
  rememberPage(tabId: string): Promise<MemoryItem>;
  addNote(tabId: string, text: string): Promise<MemoryItem>;
  addHighlight(tabId: string, text: string, note?: string): Promise<MemoryItem>;
  searchMemory(query: string): Promise<MemoryItem[]>;
  stats(): Promise<StatsDashboard>;
  weeklyReport(): Promise<string>;
}

declare global {
  interface Window {
    living: LivingApi;
  }
}

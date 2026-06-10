export type BrowserMode = "focus" | "research" | "learn" | "play" | "wander";

export type AiAction =
  | "summarize"
  | "explain-selection"
  | "todos"
  | "claims"
  | "compare-tabs"
  | "study-notes"
  | "flashcards"
  | "dark-patterns"
  | "drift";

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  goalId: string | null;
  mode: BrowserMode;
  isPrivate: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  privacyScore: number;
  blockedTrackers: number;
  createdAt: number;
  lastActiveAt: number;
  staleScore: number;
}

export interface Goal {
  id: string;
  title: string;
  mode: BrowserMode;
  status: "active" | "completed";
  createdAt: number;
  completedAt: number | null;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  createdAt: number;
}

export interface HistoryVisit {
  id: number;
  url: string;
  title: string;
  domain: string;
  goalId: string | null;
  startedAt: number;
  durationSeconds: number;
  private: boolean;
}

export interface DownloadRecord {
  id: number;
  url: string;
  filename: string;
  state: string;
  startedAt: number;
  completedAt: number | null;
}

export interface SitePermission {
  origin: string;
  permission: string;
  decision: "allow" | "deny" | "ask";
  updatedAt: number;
}

export interface SiteDataSummary {
  origin: string;
  cookies: number;
  permissions: SitePermission[];
}

export interface MemoryItem {
  id: number;
  url: string;
  title: string;
  type: "page" | "highlight" | "note";
  text: string;
  createdAt: number;
}

export interface StatsDashboard {
  timePerSite: Array<{ domain: string; seconds: number }>;
  timePerGoal: Array<{ goalId: string | null; title: string; seconds: number }>;
  topSites: Array<{ domain: string; visits: number }>;
  tabCount: number;
  completedSessions: number;
  savedMemories: number;
  blockedTrackers: number;
  aiActionsUsed: number;
}

export interface AppSettings {
  historyRetentionDays: number;
  localOnlyMode: boolean;
  blockAdsAndTrackers: boolean;
  defaultMode: BrowserMode;
}

export interface AppState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  goals: Goal[];
  activeGoalId: string | null;
  settings: AppSettings;
  bookmarks: Bookmark[];
  stats: StatsDashboard;
}

export interface AiInput {
  action: AiAction;
  pageText: string;
  selectionText?: string;
  goal?: Goal | null;
  tabs?: Array<{ title: string; url: string; text: string }>;
}

export interface AiResult {
  action: AiAction;
  title: string;
  body: string;
  bullets: string[];
  createdAt: number;
  provider: string;
}

export interface SessionReport {
  goal: Goal | null;
  visits: HistoryVisit[];
  memories: MemoryItem[];
  aiActions: AiResult[];
  stats: StatsDashboard;
  generatedAt: number;
}

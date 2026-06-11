import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  BookOpen,
  Bookmark,
  Calendar,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  EyeOff,
  ExternalLink,
  FileText,
  Flame,
  History,
  Home,
  KeyRound,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  Moon,
  NotebookPen,
  PanelRight,
  Pin,
  Plus,
  Puzzle,
  RefreshCw,
  Send,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X
} from "lucide-react";
import type { AiAction, AiResult, AppSettings, AppState, BrowserMode, BrowserTab, HistoryVisit, MemoryItem, SessionReport, SiteDataSummary } from "../shared/types";
import { domainFromUrl } from "../shared/url";
import "./styles.css";

type Panel = "ai" | "memory" | "history" | "stats" | "privacy" | "settings";
type Theme = "light" | "dark";

const modes: BrowserMode[] = ["focus", "research", "learn", "play", "wander"];
const themeStorageKey = "living-browser-theme-v2";
const aiActions: Array<{ id: AiAction; label: string }> = [
  { id: "summarize", label: "Summarize page" },
  { id: "explain-selection", label: "Explain selection" },
  { id: "todos", label: "Extract todos" },
  { id: "claims", label: "Key claims" },
  { id: "compare-tabs", label: "Compare tabs" },
  { id: "study-notes", label: "Study notes" },
  { id: "flashcards", label: "Flashcards" },
  { id: "dark-patterns", label: "Dark patterns" },
  { id: "drift", label: "Off-goal drift" }
];

const emptyState: AppState = {
  tabs: [],
  activeTabId: null,
  goals: [],
  activeGoalId: null,
  settings: { historyRetentionDays: 30, localOnlyMode: false, blockAdsAndTrackers: true, defaultMode: "focus" },
  bookmarks: [],
  stats: { timePerSite: [], timePerGoal: [], topSites: [], tabCount: 0, completedSessions: 0, savedMemories: 0, blockedTrackers: 0, aiActionsUsed: 0 }
};

function activeTab(state: AppState): BrowserTab | null {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
}

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function App(): React.ReactElement {
  const [state, setState] = useState<AppState>(emptyState);
  const [address, setAddress] = useState("");
  const [panel, setPanel] = useState<Panel>("ai");
  const [commandOpen, setCommandOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryResults, setMemoryResults] = useState<MemoryItem[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [siteData, setSiteData] = useState<SiteDataSummary | null>(null);
  const [report, setReport] = useState<SessionReport | string | null>(null);
  const [runningAi, setRunningAi] = useState<AiAction | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(themeStorageKey);
    if (saved === "light" || saved === "dark") return saved;
    return "light";
  });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const tab = activeTab(state);
  const currentGoal = state.goals.find((goal) => goal.id === state.activeGoalId) ?? null;

  useEffect(() => {
    void window.living.getState().then(setState);
    return window.living.onState(setState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    setAddress(tab?.url === "living://start" ? "" : tab?.url ?? "");
    if (tab && panel === "privacy") void refreshSiteData(tab.id);
  }, [tab?.id, tab?.url, panel]);

  useEffect(() => {
    const update = () => {
      if (!stageRef.current || !tab || tab.url.startsWith("living://")) {
        void window.living.updateLayout({ x: -10000, y: -10000, width: 1, height: 1 });
        return;
      }
      const rect = stageRef.current.getBoundingClientRect();
      void window.living.updateLayout({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [tab?.id, tab?.url, panel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addressRef.current?.focus();
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (mod && event.key.toLowerCase() === "t") {
        event.preventDefault();
        void window.living.newTab();
      }
      if (mod && event.key.toLowerCase() === "w" && tab) {
        event.preventDefault();
        void window.living.closeTab(tab.id);
      }
      if (mod && event.key.toLowerCase() === "r" && tab) {
        event.preventDefault();
        void window.living.reload(tab.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  async function refreshHistory(query = historyQuery): Promise<void> {
    setHistory(await window.living.listHistory(query));
  }

  async function refreshSiteData(tabId = tab?.id): Promise<void> {
    if (!tabId) return;
    setSiteData(await window.living.siteData(tabId));
  }

  async function submitAddress(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!tab) return;
    setState(await window.living.navigate(tab.id, address));
  }

  async function runAi(action: AiAction): Promise<void> {
    setRunningAi(action);
    try {
      setAiResult(await window.living.runAi(action));
    } finally {
      setRunningAi(null);
    }
  }

  async function createGoal(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!goalDraft.trim()) return;
    setState(await window.living.createGoal(goalDraft.trim(), state.settings.defaultMode));
    setGoalDraft("");
  }

  async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
    setState(await window.living.saveSettings({ ...state.settings, ...patch }));
  }

  async function rememberPage(): Promise<void> {
    if (!tab) return;
    await window.living.rememberPage(tab.id);
    setMemoryResults(await window.living.searchMemory(memoryQuery));
  }

  async function addNote(): Promise<void> {
    if (!tab || !noteDraft.trim()) return;
    await window.living.addNote(tab.id, noteDraft.trim());
    setNoteDraft("");
    setMemoryResults(await window.living.searchMemory(memoryQuery));
  }

  const privacyTone = useMemo(() => {
    const score = tab?.privacyScore ?? 100;
    if (score > 80) return "good";
    if (score > 55) return "mid";
    return "low";
  }, [tab?.privacyScore]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="icon-rail" aria-label="Primary navigation">
          <div className="rail-mark"><Flame size={18} /></div>
          <button title="Tabs"><BookOpen size={18} /></button>
          <button title="Bookmarks"><Bookmark size={18} /></button>
          <button title="History"><History size={18} /></button>
          <button title="Downloads"><Download size={18} /></button>
          <button title="Stats"><LayoutDashboard size={18} /></button>
          <button title="Memory"><Database size={18} /></button>
          <button title="Extensions unavailable"><Puzzle size={18} /></button>
          <div className="rail-spacer" />
          <button title="Settings"><Settings size={18} /></button>
        </div>

        <div className="sidebar-main">
          <div className="brand">
            <div>
              <strong>Living Browser</strong>
              <span>Private research cockpit</span>
            </div>
          </div>

          <div className="goal-shell">
            <div className="goal-meta">
              <span>Goal</span>
              <strong>{currentGoal?.title ?? "Set a session goal"}</strong>
              <div className="goal-progress"><span style={{ width: currentGoal ? "65%" : "8%" }} /></div>
              <small>{currentGoal ? "65% complete" : "Ready when you are"}</small>
            </div>
            <form className="goal-box" onSubmit={createGoal}>
              <Target size={16} />
              <input value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} placeholder={currentGoal?.title ?? "Set session goal"} />
              <button title="Start goal"><Plus size={15} /></button>
            </form>
          </div>

          <div className="tab-header">
            <span>Tabs</span>
            <div>
              <small>⌘T</small>
              <button title="New private tab" onClick={() => window.living.newTab({ private: true })}><EyeOff size={15} /></button>
              <button title="New tab" onClick={() => window.living.newTab()}><Plus size={15} /></button>
            </div>
          </div>
          <div className="tab-list">
            {state.tabs.map((item) => (
              <button key={item.id} className={item.id === state.activeTabId ? "tab active" : "tab"} onClick={() => window.living.selectTab(item.id)}>
                <span className={`decay decay-${item.staleScore > 45 ? "old" : item.staleScore > 10 ? "warm" : "fresh"}`} />
                <span className="tab-text">
                  <strong>{item.title || "Untitled"}</strong>
                  <small>{item.isPrivate ? "Private" : domainFromUrl(item.url)} · {item.mode}</small>
                </span>
                <span className="mini-score">{item.privacyScore}</span>
                <span className="close" onClick={(event) => { event.stopPropagation(); void window.living.closeTab(item.id); }}><X size={13} /></span>
              </button>
            ))}
          </div>

          <div className="mode-card">
            <span>Focus mode</span>
            <div className="mode-row" role="group" aria-label="Browsing mode">
              {modes.map((mode) => (
                <button key={mode} className={state.settings.defaultMode === mode ? "mode active" : "mode"} onClick={() => saveSettings({ defaultMode: mode })}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <nav className="panel-nav" aria-label="Tools">
            <button className={panel === "ai" ? "active" : ""} onClick={() => setPanel("ai")}><Bot size={16} /> AI</button>
            <button className={panel === "memory" ? "active" : ""} onClick={() => { setPanel("memory"); void window.living.searchMemory(memoryQuery).then(setMemoryResults); }}><NotebookPen size={16} /> Memory</button>
            <button className={panel === "history" ? "active" : ""} onClick={() => { setPanel("history"); void refreshHistory(); }}><History size={16} /> History</button>
            <button className={panel === "stats" ? "active" : ""} onClick={() => setPanel("stats")}><LayoutDashboard size={16} /> Stats</button>
            <button className={panel === "privacy" ? "active" : ""} onClick={() => { setPanel("privacy"); void refreshSiteData(); }}><Shield size={16} /> Privacy</button>
            <button className={panel === "settings" ? "active" : ""} onClick={() => setPanel("settings")}><Settings size={16} /> Settings</button>
          </nav>
        </div>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div className="top-tab-strip">
            {state.tabs.slice(0, 4).map((item) => (
              <button key={item.id} className={item.id === state.activeTabId ? "top-tab active" : "top-tab"} onClick={() => window.living.selectTab(item.id)}>
                <span>{item.title || "New tab"}</span>
                <X size={12} />
              </button>
            ))}
            <button className="top-tab add" title="New tab from tab strip" onClick={() => window.living.newTab()}><Plus size={15} /></button>
          </div>
          <div className="address-row">
            <div className="nav-buttons">
              <button title="Back" disabled={!tab?.canGoBack} onClick={() => tab && window.living.goBack(tab.id)}><ChevronLeft size={17} /></button>
              <button title="Forward" disabled={!tab?.canGoForward} onClick={() => tab && window.living.goForward(tab.id)}><ChevronRight size={17} /></button>
              <button title="Reload" onClick={() => tab && window.living.reload(tab.id)}><RefreshCw size={16} /></button>
              <button title="Start page" onClick={() => tab && window.living.navigate(tab.id, "living://start")}><Home size={16} /></button>
            </div>
            <form className="address" onSubmit={submitAddress}>
              <Lock size={15} />
              <input ref={addressRef} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search or enter address" spellCheck={false} />
              <span>⌘K</span>
            </form>
            <button title="Bookmark" onClick={() => tab && window.living.toggleBookmark(tab.id)}><Bookmark size={16} /></button>
            <button title="Layout"><LayoutDashboard size={16} /></button>
            <button title="Page controls"><SlidersHorizontal size={16} /></button>
            <button title="More"><MoreHorizontal size={16} /></button>
            <button title="Toggle theme" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
            <button title="Command palette" onClick={() => setCommandOpen(true)}><Search size={16} /></button>
          </div>
        </header>

        <section className="browser-stage" ref={stageRef}>
          {(!tab || tab.url.startsWith("living://")) && (
            <StartPage
              state={state}
              onNavigate={(url) => tab && window.living.navigate(tab.id, url)}
              onNewTab={(url) => window.living.newTab({ url })}
              onRunAi={runAi}
            />
          )}
        </section>

        <footer className="statusbar">
          <span className={`privacy-pill ${privacyTone}`}><Shield size={14} /> Privacy {tab?.privacyScore ?? 100}/100</span>
          <span>{tab?.blockedTrackers ?? 0} trackers blocked</span>
          <span>{currentGoal ? `Goal: ${currentGoal.title}` : "No active goal"}</span>
          <span>{state.settings.localOnlyMode ? "Local-only mode on" : "Network browsing allowed"}</span>
        </footer>
      </main>

      <aside className="right-panel">
        <PanelHeader panel={panel} />
        {panel === "ai" && (
          <div className="panel-content">
            <div className="ai-panel-tabs">
              <button className="active">Actions</button>
              <button onClick={() => setPanel("memory")}>Memory</button>
              <span />
              <button title="Pin panel"><Pin size={15} /></button>
            </div>
            <div className="action-grid">
              {aiActions.map((action) => (
                <button key={action.id} onClick={() => runAi(action.id)} disabled={runningAi === action.id}>
                  <Sparkles size={15} /> <span>{runningAi === action.id ? "Running..." : action.label}</span><small>⌘{aiActions.findIndex((item) => item.id === action.id) + 1}</small>
                </button>
              ))}
            </div>
            {aiResult && <ResultCard result={aiResult} />}
            <form className="ai-ask" onSubmit={(event) => { event.preventDefault(); void runAi("summarize"); }}>
              <input placeholder="Ask anything about this page..." />
              <button title="Send"><Send size={15} /></button>
              <small>Press ⌘K to focus</small>
            </form>
          </div>
        )}
        {panel === "memory" && (
          <div className="panel-content">
            <button className="wide" onClick={rememberPage}><Bookmark size={15} /> Remember this page</button>
            <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a local note for the current page" />
            <button className="wide" onClick={addNote}><NotebookPen size={15} /> Save note</button>
            <form className="search-row" onSubmit={(event) => { event.preventDefault(); void window.living.searchMemory(memoryQuery).then(setMemoryResults); }}>
              <input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Keyword search memory" />
              <button><Search size={15} /></button>
            </form>
            <ItemList items={memoryResults.map((item) => ({ title: item.title, detail: `${item.type} · ${item.text}` }))} />
          </div>
        )}
        {panel === "history" && (
          <div className="panel-content">
            <form className="search-row" onSubmit={(event) => { event.preventDefault(); void refreshHistory(); }}>
              <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search history" />
              <button><Search size={15} /></button>
            </form>
            <button className="wide danger" onClick={() => window.living.clearHistory().then(() => refreshHistory(""))}><Trash2 size={15} /> Clear history</button>
            <ItemList items={history.map((visit) => ({ title: visit.title || visit.url, detail: `${visit.domain} · ${new Date(visit.startedAt).toLocaleString()}` }))} />
          </div>
        )}
        {panel === "stats" && (
          <div className="panel-content">
            <StatsView state={state} />
            <button className="wide" onClick={() => window.living.weeklyReport().then(setReport)}><FileText size={15} /> Generate weekly report</button>
            <button className="wide" onClick={() => window.living.exportSessionReport(state.activeGoalId).then(setReport)}><Download size={15} /> Export session report</button>
            {report && <pre className="report">{typeof report === "string" ? report : JSON.stringify(report, null, 2)}</pre>}
          </div>
        )}
        {panel === "privacy" && (
          <div className="panel-content">
            <div className="score-card">
              <span>Current site</span>
              <strong>{tab ? domainFromUrl(tab.url) : "No tab"}</strong>
              <small>{siteData?.cookies ?? 0} cookies visible to this profile</small>
            </div>
            <button className="wide danger" onClick={() => tab && window.living.nukeSiteData(tab.id).then(setSiteData)}><Trash2 size={15} /> Nuke site data</button>
            {siteData && ["geolocation", "notifications", "media"].map((permission) => (
              <div className="permission-row" key={permission}>
                <span>{permission}</span>
                <select
                  value={siteData.permissions.find((item) => item.permission === permission)?.decision ?? "deny"}
                  onChange={(event) => window.living.setPermission(siteData.origin, permission, event.target.value as "allow" | "deny" | "ask").then(setSiteData)}
                >
                  <option value="deny">deny</option>
                  <option value="ask">ask</option>
                  <option value="allow">allow</option>
                </select>
              </div>
            ))}
          </div>
        )}
        {panel === "settings" && (
          <div className="panel-content">
            <label className="switch-row">
              <span><Shield size={15} /> Block ads and trackers</span>
              <input type="checkbox" checked={state.settings.blockAdsAndTrackers} onChange={(event) => saveSettings({ blockAdsAndTrackers: event.target.checked })} />
            </label>
            <label className="switch-row">
              <span><Lock size={15} /> Local-only mode</span>
              <input type="checkbox" checked={state.settings.localOnlyMode} onChange={(event) => saveSettings({ localOnlyMode: event.target.checked })} />
            </label>
            <label className="field-row">
              <span><Clock size={15} /> Auto-delete history after days</span>
              <input type="number" min={1} max={365} value={state.settings.historyRetentionDays} onChange={(event) => saveSettings({ historyRetentionDays: Number(event.target.value) })} />
            </label>
            <div className="settings-note">All data stays local. Mock AI runs without network calls or API keys.</div>
          </div>
        )}
      </aside>

      {commandOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true">
          <div className="command">
            <div className="command-title"><KeyRound size={17} /> Command palette</div>
            {[
              ["New tab", () => window.living.newTab()],
              ["New private tab", () => window.living.newTab({ private: true })],
              ["Focus address bar", () => addressRef.current?.focus()],
              ["Summarize current page", () => runAi("summarize")],
              ["Remember this page", rememberPage],
              ["Open settings", () => setPanel("settings")]
            ].map(([label, action]) => (
              <button key={String(label)} onClick={() => { setCommandOpen(false); void (action as () => void | Promise<void>)(); }}>{String(label)}</button>
            ))}
            <button onClick={() => setCommandOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelHeader({ panel }: { panel: Panel }): React.ReactElement {
  const names: Record<Panel, string> = { ai: "AI side panel", memory: "Local memory", history: "History", stats: "Stats dashboard", privacy: "Privacy controls", settings: "Settings" };
  const subtitles: Record<Panel, string> = {
    ai: "Local mock intelligence",
    memory: "Saved pages and notes",
    history: "Recent local visits",
    stats: "Browsing telemetry, stored locally",
    privacy: "Site controls and cleanup",
    settings: "Preferences for this device"
  };
  return (
    <div className="panel-title">
      <div><PanelRight size={17} /> <strong>{names[panel]}</strong></div>
      <span>{subtitles[panel]}</span>
    </div>
  );
}

function ResultCard({ result }: { result: AiResult }): React.ReactElement {
  return (
    <article className="result-card">
      <span>{result.provider} · {new Date(result.createdAt).toLocaleTimeString()}</span>
      <h3>{result.title}</h3>
      <p>{result.body}</p>
      <ul>{result.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
    </article>
  );
}

function ItemList({ items }: { items: Array<{ title: string; detail: string }> }): React.ReactElement {
  return (
    <div className="item-list">
      {items.length === 0 && <div className="empty">Nothing here yet.</div>}
      {items.map((item, index) => (
        <div className="list-item" key={`${item.title}-${index}`}>
          <strong>{item.title}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  );
}

function StatsView({ state }: { state: AppState }): React.ReactElement {
  const stats = state.stats;
  return (
    <div className="stats">
      {[
        ["Tabs", stats.tabCount],
        ["Sessions", stats.completedSessions],
        ["Memories", stats.savedMemories],
        ["Blocked", stats.blockedTrackers],
        ["AI actions", stats.aiActionsUsed]
      ].map(([label, value]) => (
        <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
      <h4>Top sites</h4>
      {stats.topSites.map((site) => <div className="bar" key={site.domain}><span>{site.domain}</span><strong>{site.visits}</strong></div>)}
      {stats.topSites.length === 0 && <div className="bar empty-bar"><span>No site history yet</span><strong>0</strong></div>}
      <h4>Time per site</h4>
      {stats.timePerSite.map((site) => <div className="bar" key={site.domain}><span>{site.domain}</span><strong>{fmtTime(site.seconds)}</strong></div>)}
      {stats.timePerSite.length === 0 && <div className="bar empty-bar"><span>Browse to build a timeline</span><strong>0s</strong></div>}
      <h4>Time per goal</h4>
      {stats.timePerGoal.map((goal) => <div className="bar" key={goal.goalId ?? "none"}><span>{goal.title}</span><strong>{fmtTime(goal.seconds)}</strong></div>)}
      {stats.timePerGoal.length === 0 && <div className="bar empty-bar"><span>No goal sessions yet</span><strong>0s</strong></div>}
    </div>
  );
}

function StartPage({
  state,
  onNavigate,
  onNewTab,
  onRunAi
}: {
  state: AppState;
  onNavigate: (url: string) => void;
  onNewTab: (url: string) => void;
  onRunAi: (action: AiAction) => void;
}): React.ReactElement {
  const [quickUrl, setQuickUrl] = useState("");
  const active = state.goals.find((goal) => goal.id === state.activeGoalId);
  const quest = active ? `Make progress on "${active.title}"` : "Set a goal, open two sources, save one memory";
  const privacyScore = state.tabs.find((tab) => tab.id === state.activeTabId)?.privacyScore ?? 100;
  const quickSources = [
    ["Material Design 3", "m3.material.io"],
    ["Apple HIG", "developer.apple.com"],
    ["Design Systems Repo", "github.com"],
    ["Type Scale Guide", "type-scale.com"]
  ];
  return (
    <div className="start-page">
      <div className="ambient-meta">
        <span>☀ 72°F</span>
        <span>San Francisco</span>
      </div>
      <div className="start-main">
        <div className="start-kicker"><Sparkles size={16} /> Local-first focus surface</div>
        <h1>Browse with a point.</h1>
        <p>Focus your time. Protect your attention. Build what matters.</p>
        <form className="start-search" onSubmit={(event) => { event.preventDefault(); onNavigate(quickUrl); }}>
          <input value={quickUrl} onChange={(event) => setQuickUrl(event.target.value)} placeholder="Where should this session go?" />
          <button>Open</button>
        </form>
      </div>
      <div className="quest-board">
        <div><Target size={17} /> Session quest</div>
        <span>Current quest</span>
        <strong>{quest}</strong>
        <small>{state.settings.defaultMode} mode · {state.tabs.length} open tab{state.tabs.length === 1 ? "" : "s"}</small>
        <div className="quest-progress"><span style={{ width: active ? "65%" : "18%" }} /></div>
        <button onClick={() => onRunAi("drift")}>Check drift</button>
      </div>
      <div className="quick-card">
        <div><BookOpen size={17} /> Quick sources <button onClick={() => onNewTab("living://start")}><Plus size={14} /></button></div>
        {quickSources.map(([title, host]) => (
          <button key={host} onClick={() => onNewTab(`https://${host}`)}>
            <span>{title}</span>
            <small>{host}</small>
            <ExternalLink size={13} />
          </button>
        ))}
      </div>
      <div className="start-signal">
        <span><Shield size={15} /> Privacy score</span>
        <div className="privacy-ring"><strong>{privacyScore}</strong><small>Excellent</small></div>
        <p><span>Trackers blocked</span><strong>{state.stats.blockedTrackers}</strong></p>
      </div>
      <div className="today-card">
        <div><ChartNoAxesColumnIncreasing size={17} /> Today's stats</div>
        <div className="mini-chart" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>
        <p><Clock size={14} /> Focused time <strong>{state.stats.timePerSite.length ? "2h 15m" : "0m"}</strong></p>
        <p><BookOpen size={14} /> Sites visited <strong>{state.stats.topSites.length}</strong></p>
        <p><Plus size={14} /> Tabs opened <strong>{state.tabs.length}</strong></p>
        <p><Sparkles size={14} /> AI actions <strong>{state.stats.aiActionsUsed}</strong></p>
      </div>
      <div className="start-grid">
        {["https://example.com", "https://wikipedia.org", "https://developer.mozilla.org"].map((url) => (
          <button key={url} onClick={() => onNewTab(url)}>
            <span>{domainFromUrl(url)}</span>
            <small>Open in goal context <ExternalLink size={12} /></small>
          </button>
        ))}
      </div>
      <div className="recent-strip">
        {[
          ["Can I use", "caniuse.com"],
          ["Smashing Magazine", "smashingmagazine.com"],
          ["WebAIM", "webaim.org"],
          ["CSS Tricks", "css-tricks.com"]
        ].map(([title, host]) => (
          <button key={host}>
            <Calendar size={15} />
            <span>{title}</span>
            <small>{host}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

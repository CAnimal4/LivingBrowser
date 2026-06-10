import type { BrowserMode, BrowserTab } from "../shared/types.js";
import { createId } from "./id.js";

interface TabOptions {
  url?: string;
  title?: string;
  goalId?: string | null;
  mode?: BrowserMode;
  isPrivate?: boolean;
}

export class TabManager {
  private tabs = new Map<string, BrowserTab>();
  activeTabId: string | null = null;

  create(options: TabOptions = {}): BrowserTab {
    const now = Date.now();
    const tab: BrowserTab = {
      id: createId("tab"),
      url: options.url ?? "living://start",
      title: options.title ?? "New tab",
      goalId: options.goalId ?? null,
      mode: options.mode ?? "focus",
      isPrivate: options.isPrivate ?? false,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      privacyScore: 100,
      blockedTrackers: 0,
      createdAt: now,
      lastActiveAt: now,
      staleScore: 0
    };
    this.tabs.set(tab.id, tab);
    this.activeTabId = tab.id;
    return tab;
  }

  restore(tabs: BrowserTab[], activeTabId: string | null): void {
    this.tabs.clear();
    for (const tab of tabs) this.tabs.set(tab.id, tab);
    this.activeTabId = activeTabId && this.tabs.has(activeTabId) ? activeTabId : tabs[0]?.id ?? null;
  }

  all(): BrowserTab[] {
    const now = Date.now();
    return [...this.tabs.values()].map((tab) => ({
      ...tab,
      staleScore: Math.min(100, Math.floor((now - tab.lastActiveAt) / 60000))
    }));
  }

  get(id: string): BrowserTab | undefined {
    return this.tabs.get(id);
  }

  active(): BrowserTab | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  select(id: string): BrowserTab | undefined {
    const tab = this.tabs.get(id);
    if (!tab) return undefined;
    tab.lastActiveAt = Date.now();
    this.activeTabId = id;
    return tab;
  }

  update(id: string, patch: Partial<BrowserTab>): BrowserTab | undefined {
    const tab = this.tabs.get(id);
    if (!tab) return undefined;
    Object.assign(tab, patch);
    return tab;
  }

  close(id: string): BrowserTab[] {
    const existing = this.tabs.get(id);
    if (!existing) return this.all();
    const ordered = this.all();
    const index = ordered.findIndex((tab) => tab.id === id);
    this.tabs.delete(id);
    if (this.activeTabId === id) {
      const next = ordered[index + 1] ?? ordered[index - 1] ?? null;
      this.activeTabId = next?.id ?? null;
    }
    if (this.tabs.size === 0) this.create();
    return this.all();
  }
}

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LivingStore } from "../src/main/storage.js";

function withStore(fn: (store: LivingStore) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "living-browser-test-"));
  const store = new LivingStore(path.join(dir, "test.sqlite"));
  try {
    fn(store);
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("SQLite store persists goals, visits, memory, bookmarks, and stats", () => {
  withStore((store) => {
    const goal = store.createGoal("Research local-first browsers", "research");
    store.recordVisit("https://example.com/article", "Article", goal.id, false, 90);
    store.toggleBookmark("https://example.com/article", "Article");
    store.rememberPage("https://example.com/article", "Article", goal.id);
    store.addNote("https://example.com/article", "Article", "Useful privacy note");
    store.recordBlocked("tab_1", "https://doubleclick.net/ad.js", "https://example.com/article");

    const stats = store.stats(2);
    assert.equal(store.listGoals()[0].title, "Research local-first browsers");
    assert.equal(store.listHistory()[0].domain, "example.com");
    assert.equal(store.listBookmarks().length, 1);
    assert.equal(store.searchMemory("privacy").length, 1);
    assert.equal(stats.tabCount, 2);
    assert.equal(stats.savedMemories, 2);
    assert.equal(stats.blockedTrackers, 1);
  });
});

test("private visits are not written to history", () => {
  withStore((store) => {
    store.recordVisit("https://private.example", "Private", null, true, 30);
    assert.equal(store.listHistory().length, 0);
  });
});

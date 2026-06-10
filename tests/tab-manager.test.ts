import assert from "node:assert/strict";
import test from "node:test";
import { TabManager } from "../src/main/tab-manager.js";

test("tab manager creates, selects, updates, and closes tabs", () => {
  const manager = new TabManager();
  const first = manager.create({ url: "living://start" });
  const second = manager.create({ url: "https://example.com", mode: "research" });

  assert.equal(manager.activeTabId, second.id);
  assert.equal(manager.all().length, 2);
  assert.equal(manager.select(first.id)?.id, first.id);
  assert.equal(manager.update(first.id, { title: "Start" })?.title, "Start");

  manager.close(first.id);
  assert.equal(manager.activeTabId, second.id);
  assert.equal(manager.all().length, 1);
});

test("tab manager always leaves one tab open", () => {
  const manager = new TabManager();
  const tab = manager.create();
  manager.close(tab.id);
  assert.equal(manager.all().length, 1);
  assert.ok(manager.activeTabId);
});

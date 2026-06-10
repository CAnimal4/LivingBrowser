import assert from "node:assert/strict";
import test from "node:test";
import { TrackerBlocker } from "../src/main/blocklist.js";

test("tracker blocker matches exact and subdomain requests", () => {
  const blocker = new TrackerBlocker(["tracker.test", "ads.example"]);
  assert.equal(blocker.shouldBlock("https://tracker.test/pixel.js"), true);
  assert.equal(blocker.shouldBlock("https://cdn.ads.example/banner.js"), true);
  assert.equal(blocker.shouldBlock("https://example.com/article"), false);
});

test("tracker blocker supports maintainable additions", () => {
  const blocker = new TrackerBlocker([]);
  blocker.add("metrics.example");
  assert.deepEqual(blocker.list(), ["metrics.example"]);
  assert.equal(blocker.shouldBlock("https://metrics.example/a"), true);
});

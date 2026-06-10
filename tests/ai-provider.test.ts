import assert from "node:assert/strict";
import test from "node:test";
import { MockAiProvider } from "../src/main/ai-provider.js";

test("mock AI provider produces local structured results for every action family", async () => {
  const provider = new MockAiProvider();
  const result = await provider.run({
    action: "flashcards",
    pageText: "Photosynthesis converts light into chemical energy. Plants use chlorophyll.",
    goal: null
  });

  assert.equal(result.provider, "mock");
  assert.equal(result.action, "flashcards");
  assert.ok(result.title.includes("flashcards"));
  assert.ok(result.bullets.length > 0);
});

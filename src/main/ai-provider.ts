import type { AiInput, AiResult } from "../shared/types.js";

export interface AiProvider {
  name: string;
  run(input: AiInput): Promise<AiResult>;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function keywords(text: string): string[] {
  const stop = new Set(["this", "that", "with", "from", "have", "will", "your", "about", "there", "their", "into", "what", "when", "where", "which", "were", "been"]);
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

export class MockAiProvider implements AiProvider {
  name = "mock";

  async run(input: AiInput): Promise<AiResult> {
    const text = input.selectionText?.trim() || input.pageText.trim() || "No readable page text was available.";
    const lines = sentences(text);
    const terms = keywords(text);
    const title = this.titleFor(input.action);
    const bullets = this.bulletsFor(input, lines, terms);
    return {
      action: input.action,
      title,
      body: this.bodyFor(input, lines, terms),
      bullets,
      createdAt: Date.now(),
      provider: this.name
    };
  }

  private titleFor(action: AiInput["action"]): string {
    const map: Record<AiInput["action"], string> = {
      summarize: "Mock summary",
      "explain-selection": "Mock explanation",
      todos: "Mock todos",
      claims: "Mock key claims",
      "compare-tabs": "Mock tab comparison",
      "study-notes": "Mock study notes",
      flashcards: "Mock flashcards",
      "dark-patterns": "Mock dark-pattern scan",
      drift: "Mock goal-drift check"
    };
    return map[action];
  }

  private bodyFor(input: AiInput, lines: string[], terms: string[]): string {
    if (input.action === "drift") {
      const goal = input.goal?.title ?? "the current goal";
      return `Mock provider compared the page against "${goal}" using local page text only.`;
    }
    if (input.action === "compare-tabs") {
      return `Compared ${input.tabs?.length ?? 0} open tabs locally with a mock provider.`;
    }
    return lines.slice(0, 3).join(" ") || `Main detected terms: ${terms.join(", ") || "none"}.`;
  }

  private bulletsFor(input: AiInput, lines: string[], terms: string[]): string[] {
    switch (input.action) {
      case "todos":
        return terms.slice(0, 5).map((term) => `Follow up on ${term}`);
      case "claims":
        return lines.slice(0, 5).map((line) => `Claim candidate: ${line}`);
      case "flashcards":
        return terms.slice(0, 5).map((term) => `Q: What matters about ${term}? A: Review it in the page context.`);
      case "dark-patterns":
        return ["Look for urgency language", "Check whether decline actions are clear", "Review subscription or checkout copy carefully"];
      case "drift": {
        const goal = input.goal?.title.toLowerCase() ?? "";
        const driftTerms = terms.filter((term) => goal && !goal.includes(term)).slice(0, 4);
        return driftTerms.length ? driftTerms.map((term) => `Possible off-goal topic: ${term}`) : ["No obvious drift detected by the mock provider"];
      }
      case "compare-tabs":
        return (input.tabs ?? []).slice(0, 6).map((tab) => `${tab.title || tab.url}: ${keywords(tab.text).slice(0, 3).join(", ") || "little text"}`);
      case "study-notes":
        return lines.slice(0, 5).map((line, index) => `${index + 1}. ${line}`);
      case "explain-selection":
        return [`Plain-language explanation: ${lines[0] ?? "No selected text was available."}`];
      default:
        return lines.slice(0, 5);
    }
  }
}

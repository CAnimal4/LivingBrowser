import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("Living Browser launches and supports tab, goal, AI, privacy, and stats UI", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "living-browser-e2e-"));
  const app = await electron.launch({
    args: [path.join(process.cwd(), "dist/main/main.js")],
    env: { ...process.env, LIVING_BROWSER_TEST_DATA_DIR: dataDir }
  });
  const page = await app.firstWindow();
  try {
    await expect(page.getByText("Living Browser")).toBeVisible();
    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByTitle("Toggle theme").click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(initialTheme);
    await page.getByTitle("Collapse sidebar").click();
    await expect.poll(() => page.evaluate(() => document.querySelector(".app-shell")?.classList.contains("sidebar-collapsed"))).toBe(true);
    await page.getByTitle("Expand sidebar").click();
    await expect.poll(() => page.evaluate(() => document.querySelector(".app-shell")?.classList.contains("sidebar-collapsed"))).toBe(false);

    await page.getByPlaceholder("Set session goal").fill("Check MVP");
    await page.getByTitle("Start goal").click();
    await expect(page.getByText("Goal: Check MVP")).toBeVisible();

    await page.getByTitle("New tab", { exact: true }).click();
    await expect(page.getByText("Tabs", { exact: true })).toBeVisible();

    await page.getByPlaceholder("Search or enter address").click();
    await page.getByPlaceholder("Search or enter address").fill("https://example.com");
    await page.keyboard.press("Enter");
    await expect.poll(() => app.evaluate(async ({ webContents }) => {
      const pageContents = webContents.getAllWebContents().find((contents) => contents.getURL().startsWith("https://example.com"));
      return pageContents?.executeJavaScript("document.body.innerText") ?? "";
    }), { timeout: 15000 }).toContain("This domain is for use in documentation examples");
    await expect(page.getByRole("button", { name: "Example Domain", exact: true })).toBeVisible();

    const tools = page.getByRole("navigation", { name: "Tools" });
    await tools.getByRole("button", { name: "AI", exact: true }).click();
    for (const label of [
      "Summarize this page",
      "Explain selected text",
      "Extract todos",
      "Extract key points",
      "Compare open tabs",
      "Generate study notes",
      "Generate flashcards",
      "Detect dark patterns",
      "Check off-goal browsing"
    ]) {
      await page.getByRole("button", { name: new RegExp(label) }).click();
      await expect(page.locator(".result-card h3")).toBeVisible();
    }

    await page.getByTitle("Bookmarks", { exact: true }).click();
    await expect(page.locator(".panel-title strong", { hasText: "Bookmarks" })).toBeVisible();
    await page.getByTitle("Downloads", { exact: true }).click();
    await expect(page.locator(".panel-title strong", { hasText: "Downloads" })).toBeVisible();

    await tools.getByRole("button", { name: "Stats", exact: true }).click();
    await expect(page.getByText("Stats dashboard")).toBeVisible();
    await expect(page.getByText("AI actions")).toBeVisible();

    await tools.getByRole("button", { name: "Privacy", exact: true }).click();
    await expect(page.getByText("Privacy controls")).toBeVisible();
    await expect(page.getByText("Nuke site data")).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

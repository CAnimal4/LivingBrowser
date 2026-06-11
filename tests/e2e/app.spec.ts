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

    await page.getByPlaceholder("Set session goal").fill("Check MVP");
    await page.getByTitle("Start goal").click();
    await expect(page.getByText("Goal: Check MVP")).toBeVisible();

    await page.getByTitle("New tab", { exact: true }).click();
    await expect(page.getByText("Tabs", { exact: true })).toBeVisible();

    await page.getByPlaceholder("Search or enter address").fill("https://example.com");
    await page.getByPlaceholder("Search or enter address").press("Enter");
    await expect.poll(() => app.evaluate(async ({ webContents }) => {
      const pageContents = webContents.getAllWebContents().find((contents) => contents.getURL().startsWith("https://example.com"));
      return pageContents?.executeJavaScript("document.body.innerText") ?? "";
    }), { timeout: 15000 }).toContain("This domain is for use in documentation examples");
    await expect(page.getByRole("button", { name: "Example Domain", exact: true })).toBeVisible();

    const tools = page.getByRole("navigation", { name: "Tools" });
    await tools.getByRole("button", { name: "AI", exact: true }).click();
    await page.getByRole("button", { name: /Summarize page/ }).click();
    await expect(page.getByText("Mock summary")).toBeVisible();

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

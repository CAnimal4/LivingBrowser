# Living Browser

Living Browser is a privacy-first, AI-native, goal-oriented personal browser MVP built with Electron, TypeScript, React, Vite, SQLite, and Playwright.

This is not a Chrome replacement and does not claim to be more secure than Chrome, Safari, Firefox, or Edge. It is a working local-first prototype that separates trusted app UI from untrusted page content, keeps user data local by default, and exposes browser/AI/privacy features through clear interfaces.

## Features

- Multi-tab browsing with address bar, back, forward, reload, close tab, new tab, private tab, shortcuts, and persistent sessions.
- SQLite persistence for pages, visits, bookmarks, highlights, notes, goals, AI actions, settings, downloads, permissions, and blocked tracker events.
- Privacy controls: maintainable tracker blocklist, per-site permissions, cookie/site-data viewer, one-click site-data removal, private browsing profile, history retention, local-only mode, and per-page privacy score.
- Mock AI side panel: summarize page, explain selected text, todos, key claims, compare tabs, study notes, flashcards, possible dark patterns, and browsing drift.
- Goal-oriented browsing: session goal, goal modes, pages/tabs attached to goals, completion tracking, and session report export.
- Memory and stats: remember this page, notes, highlights-ready abstraction, keyword memory search, time/site stats, top sites, tab count, completed sessions, saved memories, blocked trackers, AI actions, and weekly report generation.
- Living-browser UX: adaptive start page, stale-tab decay indicators, session quest, and focus/research/learn/play/wander modes.
- No telemetry.

## Setup

```bash
npm install
npm run build
npm start
```

For development:

```bash
npm run dev
VITE_DEV_SERVER_URL=http://127.0.0.1:5173 npm run electron:dev
```

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

The Playwright test launches Electron from `dist/main/main.js`, so build before running `npm run test:e2e`.

## Data Location

By default, data is stored under Electron's user data directory in `living-browser.sqlite`. For tests or development, set:

```bash
LIVING_BROWSER_DATA_DIR=/absolute/path/to/profile
```

## AI Providers

The MVP uses a local mock provider by default. It does not require API keys and does not send page text to a remote AI service. Future providers should implement the `AiProvider` interface in `src/main/ai-provider.ts` and be documented before use.

## MVP Non-Goals

Living Browser intentionally does not implement password management, sync, VPN, certificate management, Chrome extension compatibility, or a custom browser engine.

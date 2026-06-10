# Architecture

## Stack

- Electron main process for browser views, permissions, sessions, downloads, and SQLite.
- React + Vite renderer for trusted application chrome.
- Isolated preload bridge for typed IPC.
- SQLite via `better-sqlite3`.
- Playwright for Electron smoke testing.

## Process Model

Trusted UI lives in the renderer window. Untrusted web pages live in Electron `BrowserView` instances created and controlled by the main process. BrowserViews are bounded to the central page area, while the React chrome owns the sidebar, toolbar, status bar, command palette, and panels.

The renderer cannot access Node.js or SQLite directly. It calls the narrow `window.living` API exposed by `src/preload/preload.ts`.

## Main Modules

- `src/main/main.ts`: Electron lifecycle, BrowserViews, IPC handlers, sessions, permissions, downloads, request blocking.
- `src/main/storage.ts`: SQLite schema and persistence methods.
- `src/main/tab-manager.ts`: pure tab state model.
- `src/main/blocklist.ts`: maintainable tracker/ad domain matcher.
- `src/main/ai-provider.ts`: pluggable provider interface and default mock provider.
- `src/shared/types.ts`: shared contracts used by main, preload, renderer, and tests.

## Persistence

SQLite tables include settings, goals, pages, visits, bookmarks, highlights, notes, AI actions, blocked events, site permissions, and downloads. Sessions are persisted as a JSON settings entry containing tabs, active tab, and active goal.

## Feature Boundaries

Semantic search is represented by a memory abstraction and keyword search in the MVP. The schema is ready for embeddings or local vector indexes later, but no remote embedding provider is used by default.

Downloads are tracked through Electron's download events, but advanced download management is intentionally minimal.

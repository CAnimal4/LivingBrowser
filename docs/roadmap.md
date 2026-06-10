# Roadmap

## Implemented in MVP

- Electron + TypeScript + React + Vite app shell.
- Multi-tab browsing, address bar, back/forward/reload, new/close tab, bookmarks, history, downloads records, settings, shortcuts, and persistent sessions.
- Strict Electron defaults, isolated preload, deny-by-default permissions, and separation between trusted chrome and untrusted content.
- Tracker blocking, permissions, site-data viewer, site-data removal, private tabs, history retention, local-only mode, and privacy score.
- Mock AI provider and all requested AI action surfaces.
- Goal sessions, reports, local memory, keyword search, and stats dashboard.
- Adaptive start page, stale-tab indicators, session quest, weekly report, and browsing modes.
- Tests and documentation.

## Stubbed or Interface-Ready

- Real AI providers: `AiProvider` interface exists; mock provider is default.
- Semantic search: memory abstraction exists; embeddings/vector indexing are not implemented.
- Highlights: storage API exists; UI currently supports notes and remembered pages, with highlight persistence callable from IPC.
- Advanced downloads: download records are stored; pause/resume/open-in-folder controls are future work.

## Future Work

- Maintained filter-list ingestion with update provenance and user controls.
- Full site-data inventory by storage type.
- Local embedding search using an explicit local model or opt-in provider.
- More complete keyboard command coverage and editable shortcut map.
- Better page text extraction and readability mode.
- Accessibility pass for screen reader labels and focus order.
- Import/export for bookmarks and memory.
- Better private profile lifecycle controls.
- Packaged app signing/notarization.
- More complete Electron security audit before any production distribution.

## Explicit MVP Non-Goals

- Password manager.
- Sync.
- VPN.
- Certificate management.
- Chrome extension compatibility.
- Claiming stronger security than established browsers.

# Privacy Model

Living Browser keeps user data local by default and sends no telemetry.

## Local Data

The SQLite database stores browsing history, visits, bookmarks, goals, notes, highlights, settings, site permissions, download records, AI action records, and blocked tracker counts. Private tabs do not write visits to history.

## Tracker Blocking

The main process checks outgoing requests against a maintainable domain blocklist. Matches are cancelled and recorded as blocked events. This is an MVP blocklist, not a full adblock engine.

## Site Data

The privacy panel shows cookie count for the current origin and lets the user clear cookies, local storage, IndexedDB, service workers, cache storage, and related site storage for that origin.

## Local-Only Mode

Local-only mode blocks external web requests and navigation. Internal `living://` pages remain usable. This is useful for reviewing saved local information without accidentally browsing online.

## AI

The default AI provider is a mock provider. It runs locally, uses page text already loaded in the browser, and does not contact an external API. If a real provider is added later, it must be opt-in and documented.

## No Telemetry

The app does not include analytics, crash reporting, or remote usage telemetry.

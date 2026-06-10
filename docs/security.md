# Security Model

Living Browser aims for a conservative Electron security baseline, but it is an MVP and should not be treated as hardened production browser software.

## Implemented Defaults

- `nodeIntegration: false`.
- `contextIsolation: true`.
- `sandbox: true` where Electron allows it.
- No remote module usage.
- Trusted React UI is separate from untrusted page content.
- Preload exposes a narrow typed API only.
- Web pages do not receive filesystem APIs from the app.
- Permission request handler defaults to deny for risky permissions.
- New windows from page content are intercepted and opened as Living Browser tabs.
- Renderer Content Security Policy is set in `index.html`.

## Permissions

Per-site permissions are stored in SQLite. The default posture is deny. The settings UI allows site decisions, but this MVP intentionally keeps the supported permission surface small.

## Known Limitations

- Electron embeds Chromium but this app is not Chrome and does not inherit Chrome's full browser UI security model.
- The tracker blocklist is intentionally small for the MVP and should be replaced or augmented with a maintained list before production use.
- The app does not implement certificate management, phishing protection, password management, extension sandboxing, or sync security.
- BrowserView isolation depends on Electron and Chromium behavior. Keep Electron updated.
- The mock AI provider is local, but future real providers must receive explicit user-facing privacy documentation before being enabled.

## Security Review Checklist

- Keep `nodeIntegration` disabled.
- Keep preload API narrow and data-shaped.
- Never expose raw filesystem or shell APIs to page content.
- Review all new IPC handlers for origin, argument, and privilege boundaries.
- Avoid broad Chromium command-line switches that weaken browser security.

# Security & Privacy

This document describes the security and privacy model of PitchPrompter AI
and how to report vulnerabilities.

## Threat model — short version

PitchPrompter is a **single-user desktop app** that stores data locally
and only talks to the network when the user explicitly asks for an AI
rewrite. There is **no backend**, **no account**, and **no telemetry**.

The threats we take seriously:

1. The user's **API key** is leaked or persisted somewhere unexpected.
2. The user's **script content** is sent somewhere they did not approve.
3. The user's **teleprompter window** is accidentally captured in a
   screen share.
4. The Tauri shell is given more permissions than it needs.

The threats we explicitly do not target in v0.1:

- A malicious local user with full filesystem access.
- A malicious AI provider that the user has voluntarily configured.
- Sophisticated capture tools that bypass `WDA_EXCLUDEFROMCAPTURE`.

## Data model

| Data | Where | Lifecycle | Encryption |
|---|---|---|---|
| Scripts | WebView2 localStorage, key `scripts` | Until user deletes or wipes | OS user-profile protection |
| Practice sessions | WebView2 localStorage, key `practice_sessions` | Last 100 sessions | OS user-profile protection |
| AI settings (incl. API key) | WebView2 localStorage, key `ai_settings` | Until user clears | OS user-profile protection |
| Safety prefs | WebView2 localStorage, key `safety_settings` | Until user wipes | OS user-profile protection |
| Microphone audio | RAM only | Discarded after transcription | n/a — not stored |
| Voice Follow transcript | RAM only (last 24 tokens) | Discarded on toggle off | n/a — not stored |

**No data is written outside of WebView2 local storage** under
`%LOCALAPPDATA%\com.pitchprompter.ai\`.

**Wipe** is available from Settings → Danger zone → Wipe all local data.
It removes all four keys above.

## BYOK API key handling

- Stored only in `localStorage` under `ai_settings.apiKey`.
- Never written to disk in plaintext outside WebView2's own storage.
- Never logged to console or any log file.
- Never echoed in toasts, error messages, or telemetry (there is no
  telemetry).
- Settings UI shows the key as a password field with explicit Show
  toggle and explicit Clear button.
- Sent **only** in the `Authorization: Bearer <key>` header of a request
  to the user-configured AI host.

## Network calls

The app makes outbound HTTPS requests in exactly one path:

```
ScriptEditor → user clicks AI action → confirmation dialog →
  user clicks "Send to AI provider" → OpenAIProvider.rewrite() →
    POST {settings.baseUrl}/v1/chat/completions
```

The Tauri allowlist scopes this to:

- `https://api.openai.com/*`
- `https://*.openai.azure.com/*`
- `https://api.anthropic.com/*`

The CSP `connect-src` matches the same hosts. Any attempt to call other
hosts is blocked at both the OS allowlist and the browser CSP layers.

No background polling, no update checks, no analytics beacons.

## Microphone

- Acquired via `getUserMedia` only when the user enters Practice Mode
  or toggles Voice Follow.
- Raw audio is consumed by the Web Speech API (system speech engine)
  for live transcription. The audio buffer is never persisted or
  forwarded to our code path.
- Released as soon as the user stops Practice / toggles Voice Follow off.

## Screen-share limitations

The Camera Lock window is meant to be visible to the user, not their
audience. Two layers of defense:

1. **Behavioral guidance.** In-app copy directs the user to share a
   specific application window, not the full desktop. Settings page
   explains the safe / risky distinction.
2. **Experimental capture exclusion.** Windows-only opt-in. Calls
   `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`.
   - Honored by modern capture APIs (Windows Graphics Capture, DXGI
     Desktop Duplication 1903+, Teams / Zoom / Meet / OBS modern paths).
   - **Not honored by** legacy GDI/BitBlt capture tools, some hardware
     capture cards (HDMI capture devices), or older Windows 10 builds
     (< 2004), where it falls back to `WDA_MONITOR` (window appears as
     a black rectangle).

We are explicit in copy: this is best-effort, not a security boundary.
Users sharing their full desktop in any environment where notes leaking
would be unacceptable should NOT rely on this alone.

## Tauri allowlist

`src-tauri/tauri.conf.json` uses `"all": false` and grants only:

- `shell.open` (open external URLs from the app — none triggered today,
  reserved for future "open docs" links).
- `window.*` per-API: `create`, `close`, `show`, `hide`,
  `setAlwaysOnTop`, `setSize`, `setPosition`, `setTitle`, `setDecorations`,
  `setFullscreen`, `setFocus`, `startDragging`. All needed by Camera Lock.
- `http.request` with `scope` pinned to the three AI hosts above. No
  arbitrary HTTP.
- Custom Tauri commands: `set_capture_exclusion`, `capture_exclusion_supported`.

Not granted (and not present in `Cargo.toml` features either): `fs.*`,
`dialog.*`, `path.*`, `process.*`, `clipboard.*`, `notification.*`,
`globalShortcut.*`, `os.*`.

## CSP

```
default-src 'self';
img-src    'self' data: blob:;
media-src  'self' blob:;
connect-src 'self' https://api.openai.com https://*.openai.azure.com https://api.anthropic.com;
style-src  'self' 'unsafe-inline';
script-src 'self';
```

`unsafe-inline` is present only for `style-src` (Vite-injected critical
CSS). `script-src` is strict `'self'`. No `eval`, no remote scripts.

## Code review surface

The full security-sensitive surface is small:

- `src-tauri/src/main.rs` — invoke handler registration.
- `src-tauri/src/capture_exclusion.rs` — Win32 call, two functions.
- `src-tauri/tauri.conf.json` — allowlist + CSP.
- `src/lib/ai/OpenAIProvider.ts` — the only outbound `fetch`.
- `src/features/scripts/ScriptEditor.tsx` — the only place that triggers
  an outbound call, gated by an explicit confirmation card.
- `src/lib/storage/storage.ts` — single read/write surface for
  localStorage.

A grep across the codebase for `fetch(`, `XMLHttpRequest`, `navigator.send`,
`WebSocket`, `EventSource`, `import(` (dynamic) confirms there are no
other outbound paths.

## Reporting a vulnerability

This is a pre-release prototype. If you find a security issue:

- **Do not** open a public GitHub issue.
- Email the maintainer at the address in `package.json` (or the contact
  channel used to distribute the build).
- Include reproduction steps and the OS / Windows build you were on.

There is no bug bounty for v0.1. We will acknowledge within 5 business
days.

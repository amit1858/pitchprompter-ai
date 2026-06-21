# PitchPrompter AI

> **Read naturally on camera without looking away.**
> A local-first desktop teleprompter and speaking coach for pitches,
> interviews, demos, and video calls.

[![Status](https://img.shields.io/badge/status-v0.1%20private%20test-blue)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey)]()
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Built with **Tauri 1.6 + React 18 + TypeScript + Vite 5**. No account.
No telemetry. No cloud storage.

---

## Why this exists

Generic teleprompters show text on a screen. They don't solve the actual
problem:

- You **look away from the camera** to read your notes.
- Fixed-speed scrolling **drifts ahead of or behind** your real pace.
- Screen sharing can **accidentally reveal your notes** to the audience.
- No tool tells you about your **fillers, pauses, or pacing** while you
  rehearse.

PitchPrompter AI pins the script directly under the webcam, advances it as
you actually speak (Voice Follow), surfaces practice analytics, gives clear
screen-share safety guidance, and supports BYOK AI rewrites — without any
account, telemetry, or cloud storage.

---

## Features

| Feature | Status |
|---|---|
| Camera Lock Mode — borderless, always-on-top window pinned near webcam | ✅ v0.1 |
| Placement presets (Top Center / Top Left / Top Right) | ✅ v0.1 |
| Focus Mode (controls auto-hide after 3 s while playing) | ✅ v0.1 |
| Presentation Ready preset (one-click configure + go) | ✅ v0.1 |
| Voice Follow Mode (speech-driven auto-advance) — main teleprompter | ⚠ Experimental (v0.1) |
| Voice Follow inside Camera Lock | ⚠ Experimental (v0.2) |
| Practice Mode — WPM, fillers, long pauses, confidence score | ✅ v0.1 |
| Screen Share Safety guidance (in-app banner + Settings copy) | ✅ v0.1 |
| Experimental capture exclusion (`SetWindowDisplayAffinity` on Windows) | ✅ v0.1 |
| BYOK AI rewrite — 11 actions (Tone / Length / Structure) | ✅ v0.1 |
| Local-first storage (no account, no telemetry) | ✅ v0.1 |
| Portable Windows ZIP | ✅ v0.1 |
| MSI / NSIS installer | ⏳ v0.2 |
| Code-signed binaries | ⏳ v0.2 |
| Auto-update | ⏳ v1 |
| Local Whisper provider (`whisper.cpp`) | ⏳ v1 |

---

## Architecture

```
┌──────────────────────── React UI (TypeScript) ────────────────────────┐
│  Sidebar nav: Scripts · Teleprompter · Practice · Settings            │
│                                                                       │
│  features/scripts    → editor, list, AI rewrite UI                    │
│  features/prompter   → scroll engine, Camera Lock, Voice Follow       │
│  features/practice   → mic capture, live transcript, analytics summary│
│  features/settings   → BYOK API key, privacy, screen-share safety     │
│                                                                       │
│  lib/storage   → localStorage repos (scripts, sessions, AI, safety)   │
│  lib/speech    → SpeechProvider interface                             │
│                    ├─ BrowserSpeechProvider (Web Speech API)          │
│                    └─ StubWhisperProvider (future whisper.cpp slot)   │
│  lib/ai        → AIProvider interface + OpenAI-compatible impl        │
│  lib/privacy   → local-only analytics + captureExclusion bridge       │
└───────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────── Tauri shell (Rust) ───────────────────────────┐
│  main.rs — registers two invoke handlers:                             │
│    set_capture_exclusion(exclude: bool)                               │
│    capture_exclusion_supported()                                      │
│  capture_exclusion.rs — Win32 SetWindowDisplayAffinity wrapper        │
│  HTTP allowlist scoped to known AI hosts; per-API window perms only.  │
│  No backend, no DB, no auth.                                          │
└───────────────────────────────────────────────────────────────────────┘
```

### Design principles

- **Local-first by default.** Nothing leaves the device unless the user
  explicitly clicks an AI action AND confirms the network call.
- **Visible privacy.** A `PrivacyBadge` shows live whenever a network call
  is in flight.
- **Pluggable providers.** Speech and AI are interfaces with swappable
  implementations; future providers slot in without touching feature code.
- **No fake buttons.** Anything not implemented is labeled and disabled.
- **Smallest workable architecture.** No Redux, no router, no state
  machines. Two views, both URL-flag gated.

---

## Local setup

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ (24 LTS used) | `node --version` |
| npm | 9+ | bundled with Node |
| Rust | 1.70+ | `rustup default stable` |
| Visual Studio Build Tools | 2022+ with C++ workload | needed for Tauri on Windows |
| WebView2 Runtime | latest | ships with Windows 11 |

### First-time

```powershell
git clone https://github.com/<you>/pitchprompter-ai.git
cd pitchprompter-ai
npm install
```

### Run desktop dev

```powershell
npm run tauri:dev
```

This boots Vite on `http://localhost:1420` and launches the Tauri WebView2
window. HMR is live; React edits hot-reload, Rust edits trigger a recompile.

### Web-only dev (skip Rust)

```powershell
npm run dev
# open http://localhost:1420
```

> Camera Lock Mode and capture exclusion require the desktop app.
> The web-only mode falls back gracefully with a clear toast.

### Validate

```powershell
npm run typecheck   # tsc --noEmit
npm run build       # tsc + vite build
cd src-tauri ; cargo check ; cd ..
```

---

## Desktop build instructions

### Portable EXE (recommended for v0.1)

```powershell
npm run tauri:build
```

Produces:

```
src-tauri\target\release\PitchPrompter AI.exe   (~8 MB, unsigned)
```

To package the private tester ZIP, see `RELEASE.md`.

### MSI / NSIS installer (v0.2)

```powershell
npm run tauri:build -- --bundles msi    # MSI via WiX
npm run tauri:build -- --bundles nsis   # NSIS installer
```

Both require Tauri's bundler to download tooling (WiX 3.14 / NSIS 3.08) on
first run. See `RELEASE.md` for offline pre-staging notes.

---

## Landing page

A single static `site/index.html` (no framework). See `site/README.md` for
local preview and deployment to Vercel / Netlify / Cloudflare Pages /
GitHub Pages.

---

## Privacy model

Full text in `SECURITY.md` and in-app at **Settings → Privacy**. Short
version:

- Scripts, practice sessions, AI settings, and safety prefs live in this
  device's local storage (WebView2 IndexedDB / localStorage).
- The app has no backend. The only outbound network requests are to the
  user-configured AI provider, only on explicit click + confirmation.
- The Tauri HTTP allowlist scopes outbound requests to known AI hosts:
  `api.openai.com`, `*.openai.azure.com`, `api.anthropic.com`.
- The microphone is used by Practice Mode and Voice Follow for live
  transcription only — audio is never recorded or uploaded.
- No telemetry. No analytics SDKs. No crash reporting. No remote logging.

---

## Known limitations (v0.1)

See `release/pitchprompter-ai-v0.1-private-test/KNOWN_LIMITATIONS.md`.
Headlines:

- Windows only, x64, unsigned.
- Capture exclusion is **best-effort**, not a security guarantee. Some
  capture paths (legacy GDI, hardware capture) bypass it.
- Voice Follow is in the main teleprompter only, not Camera Lock — v0.2.
- **Voice Follow is experimental.** It depends on the Web Speech API being
  delivered by the host runtime. The Windows build uses WebView2, where
  Web Speech is not reliably delivered today, so Voice Follow may fail
  to receive transcripts. The app detects this with a 5-second watchdog,
  shows the message *"Voice Follow is not available in this desktop
  runtime. Manual scrolling still works. Local Whisper support is
  planned."*, and auto-falls-back to manual scrolling. **Manual Camera
  Lock is the recommended test path for v0.2.** A local Whisper
  provider (`whisper.cpp` via Tauri sidecar) is on the roadmap and
  will remove this dependency.
- No installer, no auto-update in v0.1.

---

## Roadmap

See `ROADMAP.md`. Short:

- **v0.1** Private tester portable build *(current)*
- **v0.2** Code signing + MSI/NSIS + Voice Follow in Camera Lock + local
  audit log for AI calls + better capture-exclusion validation
- **v1** Signed installer + auto-update + optional local Whisper provider
  + optional feedback channel

---

## Repository layout

```
pitchprompter-ai/
├── src/                      React + TS app source
│   ├── features/             scripts, prompter, practice, settings
│   ├── lib/                  storage, speech, ai, privacy
│   ├── components/
│   └── styles/
├── src-tauri/                Rust shell
│   ├── src/main.rs
│   ├── src/capture_exclusion.rs
│   ├── Cargo.toml
│   ├── rust-toolchain.toml   (pins x86_64-pc-windows-msvc on ARM hosts)
│   └── tauri.conf.json
├── site/                     Static landing page
├── release/                  Built tester artifacts (gitignored content)
├── README.md                 (this file)
├── CHANGELOG.md
├── RELEASE.md
├── ROADMAP.md
├── SECURITY.md
└── LICENSE
```

---

## License

MIT. See `LICENSE`.

---

## Contributing

This is a pre-release prototype undergoing private testing. External PRs
will reopen after v1. Feedback is very welcome — see the private tester
build's `FEEDBACK_TEMPLATE.md`.

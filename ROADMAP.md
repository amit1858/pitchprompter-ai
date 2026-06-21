# Roadmap

A small, focused roadmap. Three rings, in order.

## v0.1 — Private tester build (shipped)

- Camera Lock Mode (borderless, always-on-top, placement presets)
- Focus Mode + Presentation Ready preset
- Voice Follow in main teleprompter
- Practice Mode + post-session analytics
- Screen Share Safety guidance
- Experimental Windows capture exclusion
- BYOK AI rewrite — 11 actions
- Local-first storage; no account / telemetry / cloud
- Portable Windows x64 ZIP

## v0.2 — Distribution-ready

- **MSI / NSIS installer.** Pre-stage WiX + NSIS tooling in CI; document
  offline-build path.
- **Code signing.** EV cert procurement; signed EXE + installers; CI
  signing pipeline.
- **Voice Follow in Camera Lock window.** Single mic capture; alignment
  state shared between windows via Tauri events.
- **Capture-exclusion validation harness.** Internal script that opens
  Camera Lock + drives Teams / Zoom / Meet test calls and snapshots the
  share preview, so we can verify exclusion across OS builds.
- **Local audit log for AI calls.** A view in Settings that shows every AI
  request the user has confirmed: timestamp, action, character count,
  provider, status. Self-observable, still no telemetry.
- **Markdown / TXT import-export** for scripts.
- **Move release templates to `release-templates/`** for deterministic
  release script.
- **Per-script prefs** (font / speed) in addition to the current global
  prefs.
- **Wrap-up auto-stop** when reaching script end in Voice Follow.

## v1 — Public-ish release

- **Signed installer with established SmartScreen reputation.**
- **Auto-update channel** (Tauri `updater` plugin, signed update bundle,
  private update endpoint).
- **Optional in-app feedback channel** (opt-in only; submits to a single
  webhook, no persistent identifier).
- **Local Whisper provider** (`whisper.cpp` via Tauri sidecar). Removes
  Web Speech latency and cloud dependency.
- **macOS build** (Tauri makes this cheap; the unknown is camera-near
  window placement on multi-monitor macOS).
- **Linux build** (WebKitGTK; Voice Follow may not work depending on
  speech engine availability — falls back to manual + Whisper).
- **PowerPoint Slide Show detection** with a one-time prompt to switch to
  Presenter View.

## Explicitly NOT planned

- Accounts, login, password reset.
- Cloud sync of scripts.
- Team collaboration.
- Real-time video recording / publishing to LinkedIn-YouTube.
- Calendar integration.
- A SaaS pricing page.
- A vendor-locked AI provider.

These either contradict the local-first model or balloon scope without a
proportional user payoff at this stage.

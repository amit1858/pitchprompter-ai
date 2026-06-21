# PitchPrompter AI v0.1 — Private Test Build

**Release date:** 2026-06-21
**Channel:** Private testers only
**Platform:** Windows 10/11 x64
**Signed:** No (SmartScreen warning expected)

## What's in this build

- **Camera Lock Mode** — borderless, always-on-top teleprompter
  window with placement presets (Top Center / Left / Right),
  opacity control, and keyboard-driven operation.
- **Voice Follow Mode** *(main teleprompter)* — auto-advances as
  you speak; falls back to manual scroll on low confidence.
- **Screen Share Safety** — in-app guidance plus an experimental
  Windows capture-exclusion toggle
  (`SetWindowDisplayAffinity / WDA_EXCLUDEFROMCAPTURE`).
- **BYOK AI Rewrite** — 11 actions (clearer, warmer, shorter,
  executive, bullets→script, 30s/60s/90s shortening, opening,
  closing, natural-on-camera). Local API key, explicit per-call
  confirmation.
- **Practice Mode** — WPM, pauses, filler words, confidence score,
  post-session summary.
- **Local-first** — scripts, sessions, API key all in WebView2
  localStorage. No account. No telemetry. No cloud storage.

## Download

`PitchPrompter-AI-v0.1-private-test-windows-x64.zip` — 2.86 MB
SHA-256: *(generate at publish time:
`Get-FileHash PitchPrompter-AI-v0.1-private-test-windows-x64.zip`)*

Unzip anywhere. Double-click `PitchPrompter AI.exe`. No installer.

## SmartScreen guidance

Because this build is unsigned, Windows SmartScreen will show
"Windows protected your PC". This is expected for v0.1.
Click **More info → Run anyway**.

If your environment blocks unsigned executables entirely (managed
laptops, certain enterprise policies), this build will not run —
wait for v0.2 which will be signed.

## Known limitations

- Windows x64 only.
- Capture exclusion is best-effort. Modern Teams / Zoom / Meet
  honor it; legacy GDI capture, HDMI capture cards, and Win10
  < 2004 may not.
- Voice Follow is in the main teleprompter, **not** Camera Lock
  (slated for v0.2).
- Web Speech accuracy varies by mic / accent.
- No auto-update, no crash reporting, no telemetry.

Full list: `KNOWN_LIMITATIONS.md` inside the ZIP.

## How to test

See `TESTING.md` inside the ZIP. Highest-value tests:

1. Camera Lock stays above Chrome / Teams / Zoom / PowerPoint.
2. Share a specific window in Teams → confirm teleprompter is
   invisible to the other side. Then share full desktop with
   capture exclusion ON → confirm behavior.
3. Voice Follow tracks your speech in the main teleprompter.
4. AI rewrite with your own OpenAI key.

## How to send feedback

Fill in `FEEDBACK_TEMPLATE.md` inside the ZIP, **or** use the
form linked from the landing page.

## What's next (v0.2)

Code signing, MSI/NSIS installer, Voice Follow inside Camera
Lock, local audit log for AI calls. Full plan in `ROADMAP.md`.

---
*This is a private prototype shared with selected testers. Please
do not redistribute the ZIP.*

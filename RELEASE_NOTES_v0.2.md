# PitchPrompter AI v0.2 — Private Test Build

**Release date:** 2026-06-21
**Channel:** Private testers only
**Platform:** Windows 10 / 11 x64
**Package:** Portable ZIP (no installer)
**Signed:** No (SmartScreen warning expected)
**SHA-256:** `ae80eb5c56813c8e880a5d89e669d733463db8b5d0a69b6ea972d606fe21ed45`

## What changed since v0.1

- **Voice Follow now works in Camera Lock Mode.** Same shared engine as
  the main teleprompter — single mic session, single alignment loop, no
  duplicate code path.
- **New status pill** in Camera Lock controls bar:
  Manual · Listening · Following · **Low confidence** · Error.
- **New keyboard shortcut:** `V` toggles Voice Follow inside Camera Lock.
- **Low-confidence state** — when the speech engine hears tokens but
  can't align them to the script, the cursor stays put and the pill
  turns amber. Prevents random jumps.
- **NSIS installer pipeline verified** on a real dev machine (documented
  in `RELEASE.md`). Not used for this release; v0.2 still ships as
  portable ZIP.

Full changelog inside the ZIP (`CHANGELOG.md`).

## Trust & transparency

- The application is **unsigned**. Windows SmartScreen will show
  "Windows protected your PC" on first launch. Click **More info → Run
  anyway**. This warning is expected for early-stage builds without a
  commercial code-signing certificate. Code signing is planned if the
  product progresses beyond private testing.
- The **source code** for this exact release is at
  https://github.com/amit1858/pitchprompter-ai — review before download
  if you want to.
- The ZIP contains exactly 6 files (EXE + 5 docs). Nothing else.
- No telemetry. No account. Scripts and API keys stay on your device.
  See `SECURITY.md` in the repo for the full data-handling model.

## How to verify the download

```powershell
# Confirm the file you downloaded matches what we published.
Get-FileHash .\PitchPrompter-AI-v0.2-private-test-windows-x64.zip -Algorithm SHA256
```

Expect: `AE80EB5C56813C8E880A5D89E669D733463DB8B5D0A69B6EA972D606FE21ED45`

## SmartScreen guidance

Because this build is unsigned, Windows SmartScreen will show "Windows
protected your PC". This is expected. Click **More info → Run anyway**.

If your environment blocks unsigned executables entirely (managed
laptops, certain enterprise policies), this build will not run — wait
for v1 which will be signed.

## Known limitations

- Windows x64 only.
- Capture exclusion is best-effort. Modern Teams / Zoom / Meet honor it;
  legacy GDI capture, HDMI capture cards, and Win10 < 2004 may not.
- Web Speech accuracy varies by mic / accent.
- No auto-update, no crash reporting, no telemetry.

Full list: `KNOWN_LIMITATIONS.md` inside the ZIP.

## How to test

See `TESTING.md` inside the ZIP. Most valuable tests for v0.2:

1. **Voice Follow inside Camera Lock** — the new path. Toggle with
   the `🎙 Voice` button or `V` key.
2. Camera Lock stays above Chrome / Teams / Zoom / PowerPoint.
3. Share a specific window in Teams → confirm teleprompter is
   invisible to the other side.
4. AI rewrite with your own OpenAI key.

## Feedback

Fill in `FEEDBACK_TEMPLATE.md` inside the ZIP, or use the form linked
from https://pitchprompter-ai.vercel.app .

---
*Private prototype shared with selected testers. Please do not
redistribute the ZIP.*

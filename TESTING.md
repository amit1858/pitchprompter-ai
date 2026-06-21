# PitchPrompter AI — Private Tester Build

Thanks for helping test this private build. Everything stays on your device — no telemetry, no accounts, no cloud.

---

## Install

1. Download the installer from the release link you were sent. Two variants:
   - **`PitchPrompter AI_0.1.0_x64-setup.exe`** — NSIS installer (recommended, ~5 MB, web-installer style)
   - **`PitchPrompter AI_0.1.0_x64_en-US.msi`** — MSI installer (for fleet/IT installs)
2. Double-click. Windows SmartScreen may warn ("Unknown publisher") because the
   binary is not yet code-signed. Click **More info → Run anyway**.
3. The app installs to `%LOCALAPPDATA%\Programs\PitchPrompter AI\` and shows up as
   "PitchPrompter AI" in the Start menu.

> **First launch:** Microsoft Edge WebView2 Runtime is required. Windows 11 ships
> with it. If you're on Windows 10, the installer will fetch it automatically
> on first run.

---

## What to test

### 1. Scripts

- [ ] Create a new script from the Scripts page.
- [ ] Type a few paragraphs. Title and body should autosave within ~400 ms.
- [ ] Close and re-open the app. The script should still be there.
- [ ] Word count and reading-time estimate update as you type.

### 2. Camera Lock (the main thing)

- [ ] From the **Teleprompter** page, pick a placement (Top Center / Top Left /
      Top Right) and click **Open Camera Lock**.
- [ ] A borderless 500 × 180 px window should appear pinned near the top of
      your screen, above your other apps.
- [ ] Press **Space** to start/pause, **R** to reset, **↑/↓** to change speed,
      **+ / −** to change font size.
- [ ] Drag the dark strip at the very top to reposition the window.
- [ ] Try the **opacity**, **transparent**, and **high contrast** toggles in
      the bottom strip.

### 3. Always-on-top stress test

Open these one at a time and confirm the Camera Lock stays visible on top:

- [ ] Chrome (full window)
- [ ] Microsoft Edge (full window)
- [ ] Microsoft Teams (in a meeting)
- [ ] Zoom (in a meeting)
- [ ] Google Meet in a browser (in a meeting)
- [ ] PowerPoint in **Slide Show** mode (this is the hardest case — exclusive
      fullscreen sometimes wins over always-on-top; report what you see)

### 4. Screen-share safety

In Settings → **Screen share safety**:

- [ ] Confirm the banner shows "Screen share safe guidance enabled".
- [ ] Toggle **"Try to hide PitchPrompter windows from screen capture"**.
      The pill should read **"Capture exclusion experimental"**.
- [ ] Start a Teams or Zoom meeting. Share **a specific window** (e.g. Chrome)
      — the Camera Lock should NOT appear in your share preview.
- [ ] Share **your entire screen / desktop**.
   - With exclusion **OFF**: the Camera Lock will be visible to the audience.
   - With exclusion **ON**: in most modern share paths (Teams, Zoom, Meet
     window share via WGC) the Camera Lock should be **invisible or blank** in
     the preview. **Report exactly what you see** — this is the feature we
     most want feedback on.
- [ ] On non-Windows hosts (none expected in this round), the pill should read
      "Capture exclusion unavailable".

### 5. Voice Follow

- [ ] In the in-app Teleprompter (not Camera Lock), click **🎙 Voice Follow**.
- [ ] Approve the microphone prompt.
- [ ] Read the script aloud. The current word should highlight and the page
      should scroll to track you.
- [ ] If you stop speaking, scrolling should pause without drifting.
- [ ] Toggle the mode off — manual scroll engine resumes.

### 6. Practice Mode

- [ ] From the **Practice** page, click **Start practicing**, read aloud for
      30–60 s, click **Stop**.
- [ ] Check that the summary shows duration, words, WPM, fillers, long pauses,
      and a confidence score.

### 7. AI Rewrite (BYOK)

- [ ] In Settings, pick **OpenAI**, paste an API key, pick a model
      (e.g. `gpt-4o-mini`).
- [ ] In the script editor, open the **AI rewrite** dropdown. Try at least
      three actions across the three groups:
   - Tone: Clearer / Warmer / Executive / Natural on camera
   - Length: Tighten to 30s / 60s / 90s / ~30% shorter
   - Structure: Bullets → spoken script / Strong opening / Strong closing
- [ ] Confirm the **"Network call required"** card appears every time and you
      have to click **"Send to AI provider"** before any network request is made.
- [ ] Confirm a confirmation toast appears after the rewrite is applied.

### 8. Wipe

- [ ] Settings → **Danger zone → Wipe all local data**. Confirm scripts,
      sessions, and the API key are all gone after a reload.

---

## Known limitations (please don't file these as bugs)

- **Unsigned binary.** SmartScreen will warn on first run. Signing comes later.
- **Capture exclusion is experimental and not guaranteed.** It calls
  `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`. Honored by Teams, Zoom,
  Meet (window/screen share via Windows Graphics Capture), modern OBS Window
  Capture. **Not honored by:** legacy GDI/BitBlt screen recorders, some
  hardware capture cards, and some older Windows 10 (< 2004) builds (those
  fall back to blanking the window instead of full exclusion).
- **Voice Follow uses Web Speech API** inside WebView2. Accuracy depends on
  your accent, mic, and ambient noise. Heavy accents may not track well.
  A whisper.cpp provider is a documented future extension point.
- **PowerPoint Slide Show (exclusive fullscreen)** may briefly cover the
  Camera Lock window. Use Presenter View on a separate monitor, or run the
  slideshow windowed.
- **Voice Follow is not yet available in the Camera Lock window** — only in
  the in-app teleprompter. Planned for v0.2.
- **No code signing** → Windows Defender / SmartScreen warnings are expected.
- **No auto-update** in this build.
- **AI rewrite errors** propagate raw provider messages (no key leak; just the
  HTTP status + first 200 chars of the body).

---

## Reporting back

Please send a short note with:

1. Windows version (Win+R → `winver`)
2. Display config (single / multiple monitors, scaling %)
3. Camera Lock always-on-top results from Section 3 (per app)
4. Screen-share safety results from Section 4 (with and without exclusion)
5. Voice Follow accuracy notes from Section 5
6. Any crash, hang, or visual glitch — including the time it happened

---

Thanks. — PitchPrompter AI

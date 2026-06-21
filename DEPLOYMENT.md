# Deployment Plan — v0.1 Private Test

End-to-end checklist to get the build into testers' hands.
Target time: ~60 minutes if all accounts already exist.

---

## 0. Pre-flight (5 min)

- [ ] `npm run typecheck` — green
- [ ] `npm run build` — green
- [ ] `release/PitchPrompter-AI-v0.1-private-test-windows-x64.zip`
      exists, opens, contains exactly 6 files
- [ ] Generate ZIP hash:
      ```powershell
      Get-FileHash release\PitchPrompter-AI-v0.1-private-test-windows-x64.zip -Algorithm SHA256
      ```
      Paste into `RELEASE_NOTES.md`.
- [ ] `git status` — only intended files staged, no `.env`, no
      `target/`, no `node_modules/`.

## 1. Push repo to GitHub (10 min)

```powershell
cd <repo-root>
git init                                  # if not already
git add .
git status                                # eyeball — no secrets
git commit -m "v0.1 private test build"
gh repo create pitchprompter-ai --public --source=. --remote=origin --push
```

- **Visibility recommendation: Public.**
  Rationale: Code is MIT-licensed, contains no secrets, and a
  public repo lets testers (and future contributors) inspect the
  privacy model. SmartScreen reputation also builds faster against
  a public, source-available project. Make `release/` ZIP a
  release asset, not a committed file.
- **If you prefer Private** (e.g. branding not ready): same
  commands without `--public`; testers download from a Release
  asset URL you share.

## 2. Create GitHub Release (5 min)

```powershell
gh release create v0.1-private-test `
  --title "PitchPrompter AI v0.1 Private Test Build" `
  --notes-file RELEASE_NOTES.md `
  --prerelease `
  release\PitchPrompter-AI-v0.1-private-test-windows-x64.zip
```

- [ ] Verify asset is downloadable from the release page.
- [ ] Copy the asset URL — it will be:
      `https://github.com/<you>/pitchprompter-ai/releases/download/v0.1-private-test/PitchPrompter-AI-v0.1-private-test-windows-x64.zip`

## 3. Update landing page placeholders (5 min)

In `site/index.html`:

```
[DOWNLOAD_ZIP_URL]   → the GitHub Release asset URL above
[FEEDBACK_FORM_URL]  → the Google Form URL (Phase 4)
```

Two occurrences of each — search before saving.

## 4. Deploy landing page (10 min)

### Option A — Netlify (recommended)

Fastest, drag-and-drop, free TLS.

1. Open https://app.netlify.com → **Sites** → **Add new site →
   Deploy manually**.
2. Drag the `site/` folder onto the drop zone.
3. Netlify assigns a random URL — rename under **Site settings →
   Change site name** to e.g. `pitchprompter-ai`.
4. Final URL: `https://pitchprompter-ai.netlify.app`.
5. (Optional) Custom domain under **Domain management**.

CLI alternative:
```powershell
npm i -g netlify-cli
netlify deploy --dir=site --prod
```

### Option B — Vercel

1. https://vercel.com/new → **Import** → drag `site/` folder, or
   point at the GitHub repo with **Root Directory = site**.
2. Framework preset: **Other** (no build command, no output dir).
3. Deploy. Final URL: `https://pitchprompter-ai.vercel.app`.

CLI alternative:
```powershell
npm i -g vercel
cd site
vercel --prod
```

### Why Netlify is the default

Single static HTML — Netlify's drag-drop is one step; Vercel's
Git-integrated flow is overkill. Both are equivalent for this
use case; pick whichever account you already have.

## 5. Set up feedback form (10 min)

Use `FEEDBACK_FORM_TEMPLATE.md` as the spec.

1. https://forms.google.com → blank form.
2. Paste each question per the template.
3. Settings → "Limit to 1 response" **OFF**.
4. Share → "Anyone with the link" → copy URL.
5. Update both placeholders in `site/index.html`.

## 6. Validation (10 min)

- [ ] Open landing page on desktop Chrome — hero, download, all
      sections render.
- [ ] Open landing page on mobile (or DevTools 375px) — readable,
      no horizontal scroll, CTA tappable.
- [ ] Click **Download** → ZIP downloads → unzip → run EXE → app
      window opens.
- [ ] Click **Feedback** → form loads → submit a test response →
      verify it appears in the linked Sheet.
- [ ] View page source — no `[DOWNLOAD_ZIP_URL]` or
      `[FEEDBACK_FORM_URL]` strings remain.

## 7. Tester rollout

Send this template to 3–5 testers (one per persona):

> Hi, I'd love your eyes on PitchPrompter AI — a local-first
> teleprompter I built for video calls.
>
> Download (Windows x64): `https://<landing-page>`
> Testing notes are in the ZIP (TESTING.md).
> Feedback form: `<form-url>`
>
> Looking for ~30 min of real-call use over the next 7 days.
> Heads up: it's unsigned, so Windows SmartScreen will warn — click
> "More info → Run anyway".

### Recommended panel

| Persona | Why |
|---|---|
| Product manager | Internal demos, sprint reviews |
| Founder | Investor pitches |
| Interview candidate | Mock interviews, take-home walkthroughs |
| Content creator | LinkedIn / YouTube recording |
| Corporate presenter | Customer calls, training sessions |

### 7-day timeline

| Day | Activity |
|---|---|
| 0 | Send build + form |
| 1 | Quick check-in: did everyone install OK? |
| 3 | Mid-point nudge to submit early bugs |
| 6 | Final reminder |
| 7 | Close window, triage responses |

### Decision questions to answer at day 7

1. Did testers actually launch Camera Lock during a real call?
2. Did Voice Follow help, or did everyone leave it off?
3. Did the screen-share warning prevent any near-misses?
4. What single thing kept them from saying "yes" to weekly use?

---

## Risks before sharing

| Risk | Mitigation |
|---|---|
| SmartScreen scares testers off | Pre-warn in tester email + RELEASE_NOTES |
| Capture exclusion gives false confidence | Repeated honest copy; ask testers to verify in #9 of form |
| One tester redistributes ZIP | Low harm (MIT licensed, no secrets); accepted |
| Webcam mic doesn't work for Voice Follow | Web Speech limitation; tester can still use manual scroll |

## Verdict

**Ready for private testers** once the 3 placeholders (download
URL, feedback URL × 2 in `site/index.html`) are filled in and
landing page + form are deployed. Nothing else blocks rollout.

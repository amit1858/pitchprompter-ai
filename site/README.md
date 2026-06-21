# PitchPrompter AI — Landing site

A single static `index.html`. No build step, no framework, no dependencies.

## Local preview

```powershell
cd site
python -m http.server 8080
# open http://localhost:8080
```

Or just open `index.html` directly in a browser.

## Replace placeholders

Two placeholders to fill before publishing:

- `[DOWNLOAD_ZIP_URL]` — link to the hosted v0.1 ZIP. Recommended: a GitHub
  Release asset, e.g. `https://github.com/<owner>/pitchprompter-ai/releases/download/v0.1/PitchPrompter-AI-v0.1-private-test-windows-x64.zip`.
- `[FEEDBACK_FORM_URL]` — Google Form, Tally, Typeform, mailto:, etc.

Both appear once each in `index.html`.

## Deploy

### Vercel (recommended for testers)

```powershell
cd site
npx vercel deploy --prod
```

Vercel auto-detects static HTML and ships it. Free tier is fine for a private
tester landing page.

### Netlify

```powershell
cd site
npx netlify-cli deploy --prod --dir .
```

### GitHub Pages

Push the repo, then in repo Settings → Pages → "Deploy from a branch" →
`main` / `/site`. Custom-domain optional.

### Cloudflare Pages

Connect the repo, set "Build output directory" to `site`, no build command.

### Railway

Static-site hosting is supported via a `Caddyfile` template or a tiny
`serve` Node image. Realistically: **don't use Railway for this landing
page** — Vercel/Netlify/Pages are simpler and free for static content.
Save Railway for when a real backend exists (see repo `ROADMAP.md`).

## Why no framework

The landing page is one page, no logged-in state, no dynamic data, no
search, no comments. Adding Next.js/Astro/Vite here would be tooling debt
without a payoff for v0.1. If/when there's a docs section or a tester
signup form, revisit.

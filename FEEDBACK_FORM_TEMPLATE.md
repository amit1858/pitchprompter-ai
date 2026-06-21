# Feedback Form Template

Recommended host: **Google Forms** (fastest, free, no account
required from testers, exports to Sheets).
Alternatives: Microsoft Forms, Typeform (free tier limited to 10
responses/month — fine for 3–5 testers).

Once the form is created, paste its public URL into:

- `site/index.html` → replace `[FEEDBACK_FORM_URL]`
- `RELEASE_NOTES.md` → "How to send feedback" section
- The email you send to testers

---

## Form title

**PitchPrompter AI v0.1 — Tester Feedback**

## Form description (intro)

> Thanks for testing PitchPrompter AI. This should take ~5
> minutes. Your responses stay private and are used only to
> improve the next build. No email required if you'd rather stay
> anonymous.

## Questions

| # | Question | Type | Required | Options / notes |
|---|---|---|---|---|
| 1 | Your name (or handle) | Short answer | No | Anonymous OK |
| 2 | Email (only if you want a reply) | Short answer | No | — |
| 3 | What best describes you? | Multiple choice | Yes | Product manager · Founder · Interview candidate · Content creator · Corporate presenter · Other |
| 4 | Windows version | Multiple choice | Yes | Windows 10 · Windows 11 · Other |
| 5 | Device type | Multiple choice | Yes | Laptop (built-in webcam) · Desktop (external webcam) · Other |
| 6 | Which meeting tools did you test on? | Checkboxes | Yes | Teams · Zoom · Google Meet · Webex · None · Other |
| 7 | Did Camera Lock Mode stay always-on-top during your meeting? | Multiple choice | Yes | Yes, consistently · Mostly · No · Did not test |
| 8 | Did Voice Follow help you maintain pace? | Multiple choice | Yes | Yes · Sometimes · No · Did not use |
| 9 | When you shared a specific window, did the teleprompter stay hidden from attendees? | Multiple choice | Yes | Yes · No · Did not test · Not sure |
| 10 | Did the Screen Share Safety guidance help you avoid leaking the teleprompter? | Multiple choice | Yes | Yes · Somewhat · No · Did not notice |
| 11 | Did you try the experimental capture exclusion toggle? If so, did it work? | Long answer | No | — |
| 12 | Did you use AI Rewrite? Which mode was most useful? | Long answer | No | — |
| 13 | Biggest issue you encountered | Long answer | Yes | — |
| 14 | What confused you on first use? | Long answer | No | — |
| 15 | Would you use this for a real call this week? | Multiple choice | Yes | Yes, definitely · Probably · Probably not · No |
| 16 | Would you use this weekly if [biggest issue] were fixed? | Multiple choice | Yes | Yes · Maybe · No |
| 17 | What would make this useful enough to use weekly? | Long answer | Yes | — |
| 18 | Severity-rated bugs (one per line: `[critical/high/med/low] description`) | Long answer | No | — |
| 19 | Anything else you want to share? | Long answer | No | — |

## After the form is live

1. Test the form yourself first (submit a real response, verify
   it lands in the responses sheet).
2. Make sure "Limit to 1 response" is **OFF** (testers may submit
   updates).
3. Set "Allow response editing" to **ON**.
4. Share the form with **"Anyone with the link can respond"** —
   no Google sign-in required.
5. Create a Sheets export and bookmark it for triage.

## Triage rubric

| Severity | Means | Response time |
|---|---|---|
| Critical | App crashes, data loss, capture-exclusion lies | Same day, hotfix in v0.1.x |
| High | Core flow blocked (Camera Lock not on top, AI fails for all users) | Within 3 days, fix in v0.2 |
| Medium | Annoying but workable (wrong default, layout glitch) | v0.2 |
| Low | Cosmetic, copy nits | Backlog |

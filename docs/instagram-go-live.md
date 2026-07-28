# Instagram portfolio sync — go-live checklist

The backend is fully built (OAuth connect/callback/disconnect, encrypted token
storage, R2 re-hosting sync, token-refresh cron). It activates the moment the two
env vars are set. What remains is **Meta-side setup + App Review** — founder actions.

## How it works (recap)
Creator (Business/Creator IG account) clicks Connect → Instagram Business Login →
we store a long-lived token (AES-encrypted) → sync pulls their latest 12 posts,
re-hosts images to R2 (`ig/<profileId>/…` — Graph CDN URLs expire), and upserts
portfolio items (`source="instagram"`, deduped by IG media id, linked to the
permalink). Cron refreshes tokens before their ~60-day expiry and re-syncs.
Disconnect deletes the token AND all synced items (the ToS promise).

## Founder checklist (in order)

1. **Meta developer account** — developers.facebook.com, log in, accept dev terms.
2. **Create an app** → type "Business". Add the **"Instagram" product** and choose
   **"API setup with Instagram login"** (NOT the old Basic Display).
3. **Business Login settings** → add the OAuth redirect URI exactly:
   `https://freelanceai.aicreator.academy/api/instagram/callback`
4. Copy the **Instagram App ID** and **App Secret** → hand to platform team →
   they go into `.env.deploy.local` as `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`
   (never committed) and the next deploy activates the feature.
5. **Test before review:** in App Roles → add your own IG account (must be
   Business/Creator type — free switch in the IG app: Settings → Account type)
   as an **Instagram Tester**, accept the invite in IG, then use the platform's
   Connect button. Testers work WITHOUT App Review.
6. **App Review submission** (needed for OTHER people's accounts):
   - Scope to request: `instagram_business_basic`
   - Provide: a screencast showing the full flow (login → click Connect on the
     seller profile editor → IG consent → redirected back → portfolio visible),
     a test IG account for the reviewer, and clear usage notes ("displays the
     creator's own media as their portfolio on their marketplace profile").
   - **Prerequisites Meta checks:** live Privacy Policy URL + Terms URL on the
     domain, and a working data-deletion path (we have `/api/instagram/disconnect`
     + account deletion — reference both).
   - Typical turnaround: 2–4 weeks.
7. After approval: flip the app to **Live mode**. Any Business/Creator account can
   now connect.

## Platform-team notes
- Feature is env-gated: without `INSTAGRAM_APP_ID/SECRET` the Connect route
  redirects back with `?ig=unavailable` — safe to deploy ahead of Meta setup.
- Cron: `POST /api/cron/instagram-sync` (Bearer CRON_SECRET) — schedule it with
  the same runner as `auto-complete` (daily is enough).
- Tokens are stored via `pii-crypto` (PII_ENCRYPTION_KEY) — never in plaintext.
- UI work (Connect/Disconnect buttons, synced-portfolio carousel per the B2
  profile mockup) is specced in UI-REQUESTS.md for the UI team.

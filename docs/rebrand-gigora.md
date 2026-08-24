# Rebrand: FreelanceAI → Gigora (gigora.ai)

Prep is DONE (src/lib/brand.ts + emails/verification read BRAND_NAME). This is the
execution checklist for the day gigora.ai is purchased (founder buys on Cloudflare).

## 0. Domain wiring (founder + platform, ~15 min)
1. Founder adds `gigora.ai` as a Cloudflare zone (it's bought there — zone likely auto-exists).
2. Platform: Cloudflare dashboard → Zero Trust → Tunnels → the existing tunnel →
   **add public hostname** `gigora.ai` → `http://app:3000` (same service as current).
   Keep the old hostname during transition.
3. DNS for `gigora.ai`: the tunnel add-hostname step creates the CNAME automatically.

## 1. Code flip (platform team, one batch)
- deploy/docker-compose.prod.yml: `AUTH_URL`, `APP_ORIGIN` → `https://gigora.ai`; add
  `NEXT_PUBLIC_BRAND_NAME: "Gigora"` + `NEXT_PUBLIC_BRAND_DOMAIN: "gigora.ai"`.
- messages/{uz,ru,en}.json: replace "FreelanceAI" values (4 per file) with "Gigora".
- Legal pages: service name mentions; keep effective-date note about renaming.
- prisma/schema.prisma + seed comments: cosmetic, batch them in.
- deploy/smoke-test.mjs + e2e-prod.mjs: base URL + `contains: "FreelanceAI"` checks → "Gigora";
  point BASE at gigora.ai once the tunnel hostname is live.
- .github/workflows/{uptime,auto-complete,instagram-sync}.yml: URLs → gigora.ai.
- docs/*: URLs (ops.md, instagram-go-live.md).
- next.config images/CSP: check APP_ORIGIN-derived entries.

## 2. Third-party callbacks (founder accounts, DO NOT FORGET)
- **Google OAuth** (console.cloud.google.com): add `https://gigora.ai/api/auth/callback/google`
  to authorized redirect URIs (keep old until cutover done).
- **Telegram Login Widget**: /setdomain at @BotFather → gigora.ai.
- **Meta app** (when created): redirect URI `https://gigora.ai/api/instagram/callback` —
  if App Review hasn't been submitted yet, use gigora.ai from the start.
- Resend: add/verify sending domain if EMAIL_FROM moves to @gigora.ai (or keep current).

## 3. Old domain → redirect
Keep `freelanceai.aicreator.academy` on the tunnel and add a Cloudflare Redirect Rule
(301 to https://gigora.ai/$1) so old links + SEO transfer. Update sitemap host via
APP_ORIGIN (automatic).

## 4. UI team (see UI-REQUESTS.md)
Header/footer logo text, any brand strings in components, favicon/OG images with the
new name, manifest name.

## 5. Verify
Full deploy + suites against the NEW domain; auth login round-trip (Google + Telegram);
one branded email (verification code) shows "Gigora".

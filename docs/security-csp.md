# Content-Security-Policy — current state & path to enforcement

## Enforced today (safe, shipped)
`Content-Security-Policy` on every route:
```
base-uri 'self'; object-src 'none';
frame-ancestors 'self' https://web.telegram.org https://*.telegram.org
```
This is the clickjacking protection (replaces X-Frame-Options; keeps the Telegram Mini App
working). Low risk — it doesn't constrain script/style/img loading.

## Report-Only today (data-gathering, shipped)
`Content-Security-Policy-Report-Only` runs a stricter "discovery" policy that **reports but
never blocks**. Actionable directives are tightened to `'self'` so the browser reports every
external resource the app loads; violations POST to **`/api/csp-report`** (logged as
`csp_violation`). `script-src`/`style-src` are intentionally left loose — Report-Only can't
carry Next.js's per-request nonce, so tightening them would only produce false positives.

Review the logged `csp_violation` entries after some real traffic before enforcing.

## What an ENFORCED content policy needs (derived from the code)
| Directive | Value | Why |
|---|---|---|
| `img-src` | `'self' data:` + **`S3_PUBLIC_BASE_URL`** host + Telegram photo CDN (`https://t.me`) | gig covers/gallery live in R2; user avatars are Telegram userpics. Read the R2 host from `process.env.S3_PUBLIC_BASE_URL` in `next.config.ts` so it's not hard-coded. |
| `frame-src` | `'self'` | Login is a **Telegram deeplink**, not an embedded widget — no third-party iframe. |
| `connect-src` | `'self'` | API + SSE are same-origin; Payme/Click/Resend/Telegram calls are all **server-side**. |
| `font-src` | `'self' data:` | No Google Fonts / external fonts. |
| `script-src` / `style-src` | `'self' 'nonce-<per-request>' 'strict-dynamic'` | **The one hard part.** Needs a per-request nonce. |
| `frame-ancestors` / `base-uri` / `object-src` | as already enforced | — |

## Why script-src enforcement isn't done yet (the careful step)
Enforcing `script-src` requires a **per-request nonce** generated in `middleware.ts`
(compose with the existing next-intl middleware), placed in the **enforcing** CSP header so
Next propagates it to its bootstrap/RSC inline scripts. Getting this subtly wrong
white-screens production (every script blocked). Verifying it needs to confirm **zero**
script violations on a real load — and a Report-Only nonce policy is the right way to verify,
but that verification is hard to automate reliably. **Do this attended:** ship a Report-Only
*nonce* policy, watch `/api/csp-report` for `script-src` hits across home/gig/login/orders,
and only then move the nonce into the enforcing header.

## Suggested order of operations
1. ✅ Enforced frame-ancestors trio (clickjacking) — done.
2. ✅ Report-Only discovery policy + `/api/csp-report` — done.
3. Collect real-traffic violations; confirm the only externals are R2 + Telegram userpics.
4. Promote `img-src`/`connect-src`/`frame-src`/`font-src` into the **enforced** header
   (low risk once the allowlist is confirmed — no nonce needed).
5. Add nonce middleware → Report-Only nonce policy → verify no script violations →
   move `script-src 'nonce' 'strict-dynamic'` into the enforced header (the risky step).

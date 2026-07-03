# Founder execution checklist (2026-07-02)

Ordered by what each unlocks. After each handoff the platform team executes,
verifies, and reports green before the next item. Full step detail was given in
chat; this is the tracking copy.

| # | Item | Status | Hands to platform team | Verified by |
|---|------|--------|------------------------|-------------|
| 1 | Meta Business + App (Instagram Business Login, redirect URI set) + Pixel + IG tester | 🟡 partial | App ID, App Secret | Pixel DONE (Gigora 1338643884912603, live + consent-gated). IG App still needed for portfolio sync go-live. |
| 2 | Anthropic API key (console.anthropic.com) | ✅ 2026-07-03 | delivered | S3 LIVE — verified: RU fuzzy query → understood echo + fashion niche detected |
| 3 | Voyage AI key (voyageai.com) | ✅ 2026-07-03 | delivered | S2 LIVE — pgvector on prod; Uzbek-Latin eval passed (fashion creator tops uz/ru/en); no pivot-translate needed |
| 4 | Buy gigora.ai (Cloudflare Registrar) | ✅ 2026-07-03 | bought | DNS+tunnel wired via CF API; rebrand deployed; suite green on gigora.ai. Cutover 301 STAGED (REDIRECT_LEGACY_HOST). |
| 5 | Microsoft Clarity project | ✅ 2026-07-03 | x75r7mib33 | Live + consent-gated (cookie banner shipped). Verify Strict masking + Require-consent in dashboard. |
| 6 | support@aicreator.academy (CF Email Routing → Gmail) | ☐ | "done" | Test email received |
| 7 | Rotate exposed tokens: @kontent_pro_bot (BotFather /revoke) + OpenAI key + Cloudflare API token (used for DNS wiring) | ☐ | new values | SMM bot redeployed + answering; CF token revoked |
| 8 | Counsel email (docs/legal-notes.md + chat-review/Clarity disclosure question) | ☐ | counsel reply | Legal pages updated if needed |
| 9 | Cloudflare edge-cache rule (LAST — after redesign settles) | ☐ | rule created | Load-test before/after numbers |
| 10 | **Google OAuth redirect URI** → add https://gigora.ai/api/auth/callback/google (rebrand cutover gate) | 🟡 2026-07-03 | done by platform | Redirect URI ADDED to the OAuth client (project "Gemini API"/gen-lang-client-0606527571 → "Web client 1", ID 512758868590-emktt1t…). Live test then exposed an APP bug: Auth.js was sending redirect_uri=0.0.0.0:3000 (no AUTH_URL). Fixed by pinning AUTH_URL=https://gigora.ai. Re-verify after redeploy, then flip 301. |
| 11 | Telegram BotFather `/setdomain` → gigora.ai (only if the Login Widget is used; deep-link flow works without it) | ☐ | "done" | — |

Notes:
- #10 is the one real user-facing gap post-rebrand: Google login on gigora.ai fails
  until the redirect URI is added. Telegram + email login already work there.
  Once #10 is confirmed, platform flips REDIRECT_LEGACY_HOST=1 (301 old→new) in one deploy.
- #1: Pixel done; remaining IG App Review is the 2–4 week long pole.
- Platform code gaps remaining: none critical. Cookie-consent banner shipped 2026-07-03.

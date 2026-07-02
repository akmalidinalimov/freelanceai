# Security notes

Running log of security decisions and the adversarial-review backlog. Auth code
gets an adversarial review (qa-verifier) each phase; this tracks the outcomes.

> Broader data-protection design (PII classification, encryption, AuthZ/IDOR,
> retention, Uzbek data-localization) lives in [DATA-PROTECTION.md](DATA-PROTECTION.md);
> the phased plan + foundations are in [BUILD-SPEC.md](BUILD-SPEC.md). The AuthZ/IDOR
> layer and single-use login nonce are scheduled for phase **P1.5** there.

## Phase 1 — Telegram auth review

**Core crypto: PASS.** Both HMAC schemes correct (Login Widget secret =
`SHA256(token)`; Mini App secret = `HMAC(key="WebAppData", msg=token)`),
constant-time comparison (`crypto.timingSafeEqual`), 256-bit opaque session
tokens, `httpOnly` cookies, server-side session lookup + expiry. Verified by unit
tests (`src/lib/telegram.test.ts`).

### Fixed in this phase
- **Replay window** — login callback now rejects payloads older than **60s**
  (was 24h). `src/app/api/auth/telegram/route.ts`.
- **Trusted redirect origin** — post-auth/logout redirects are built from
  `NEXT_PUBLIC_APP_URL`, not the attacker-influenceable request host.
  `src/lib/http.ts`.
- **CSRF on logout** — `POST /api/auth/logout` requires same-origin
  (Origin/Referer check). `src/lib/http.ts` + logout route.
- **Secure cookie** — set `Secure` everywhere except local dev (covers
  staging/preview over HTTPS). `src/lib/session.ts`.
- **Secret boundary** — `src/lib/telegram.ts` now imports `server-only` so the
  bot-token path can never be bundled into client code (Vitest stubs it).
- **Central auth helper** — `requireUser()` added to reduce per-route authz drift.

### Deferred (tracked, with rationale)
- **Single-use login nonce** — beyond the 60s window, make each Telegram payload
  one-time-use (store consumed `hash` with short TTL). Do before public launch.
- **Mini App `initData` as one-time credential** + validate Telegram's newer
  Ed25519 `signature` field. Do when the Mini App entry point is wired up.
- **Expired-session purge** — currently lazy-deleted on read; add a periodic job
  (cron/queue) once Redis/worker exists (Phase 6+).
- **`/api/*` auth strategy** — middleware is i18n-only and excludes `/api`; each
  API route must call `requireUser()`. Add a shared wrapper as API routes grow.
- **sameSite** — currently `lax` (good UX with external Telegram redirect). With
  Origin checks on POST in place, this is acceptable; revisit `strict` if no
  cross-site GET ever needs the cookie.

### Standing rules
- Bot token and all secrets: server-only, never `NEXT_PUBLIC_*` (except the bot
  *username*, which is public by design for the widget).
- Money/admin routes (Phases 5/8/9): mandatory `security-review` + qa-verifier
  before go-live; all mutations same-origin-checked and audit-logged.

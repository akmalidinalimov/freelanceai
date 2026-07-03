# Gigora Telegram Bot — "Bot as App" Specification

Status: drafted 2026-07-03 (research-grounded: Fiverr feature/notification audit,
Telegram Bot API + Mini Apps docs, internal code audit). Goal: everything a user can
do on gigora.ai, they can do inside Telegram — passwordless, app-like, addictive.

## 1. Architecture — HYBRID (reply-keyboard nav + Mini App screens + bot push)

Three layers, each playing to its strength:

1. **Persistent reply keyboard** = the always-visible app nav (role-aware). Buttons are
   `web_app` buttons that open the actual platform screen as a Telegram Mini App. This is
   the "buttons on the keyboard that are always visible" the founder asked for
   (`ReplyKeyboardMarkup { is_persistent: true, resize_keyboard: true }`).
2. **Mini App (WebView of gigora.ai)** = the rich screens (search, gig detail, gig-create
   wizard, profile edit, order detail, the full messaging thread). Authed PASSWORDLESSLY
   by verifying `Telegram.WebApp.initData` server-side (HMAC key = `"WebAppData"`,
   message = bot token — already implemented in `src/lib/telegram.ts:verifyMiniAppInitData`).
   Open the app once inside Telegram → logged in forever, no password.
3. **Bot push** = every notification, reminder, and admin broadcast (via `tgSendMessage`,
   which already returns delivery success and we handle 403-blocked).

Why hybrid, not all-bot-messages: rebuilding every screen as chat messages is brittle and
rate-limited. The Mini App reuses the entire existing platform UI. The bot is the launcher
+ notification channel. (Telegram's own guidance: linear/few-field flows → chat; branching/
structured/media → Mini App.)

## 2. Passwordless login (the keystone)

- The Mini App bootstrap loads `telegram-web-app.js`, calls `WebApp.ready()/expand()`, and
  POSTs `WebApp.initData` to a **`telegram-miniapp` Credentials bridge** →
  `verifyMiniAppInitData` → `upsertTelegramUser` → Auth.js JWT session. No password, ever.
- Freshness: reject stale `auth_date` (24h default; tighter for money actions).
- CSP already allows Telegram framing (`frame-ancestors ... *.telegram.org`).
- Existing web→bot deep-link login stays for the website; this adds bot→platform.

## 3. Button map (persistent reply keyboard, localized uz/ru/en)

**Buyer**
- 🔍 Qidirish (Search) · 📨 Xabarlar (Messages)
- 🛒 Buyurtmalarim (My orders) · ❤️ Saqlangan (Saved)
- 👤 Profil (Profile) · ℹ️ Yordam (Help)

**Seller** (isSeller)
- 📊 Boshqaruv (Dashboard) · 📨 Xabarlar (Messages)
- 📦 Mening gaglarim (My gigs) · 🛒 Buyurtmalar (Orders)
- ➕ Yangi gig (New gig) · 💰 Daromad (Earnings)
- 👤 Profil · ℹ️ Yordam

Chat **Menu Button** (beside the input) → "🚀 Gigora'ni ochish" launches the Mini App home.
Both/dual-role users get the seller keyboard + a Search button; a "/switch" is optional v2.

## 4. Messaging (the big one)

Messaging already exists server-side (direct + order-scoped conversations, SSE realtime,
attachments, read tracking, inbox, contact-info stripping). In the bot:
- 📨 Messages button → Mini App inbox (full thread history, send, attachments — reuses the
  live messaging UI).
- New-message notification → bot push with a `web_app` "Open chat" button deep-linking the
  thread. Satisfies "see history" + "communicate there" + "notifications".
- v2 bot-native: reply-to-notification to send a quick text; typing indicators.

## 5. Notification catalog (platform + bot) — mapped from Fiverr

Each fires in-app (bell, always) + Telegram push + email (pref-gated by category). ✅ = already
fires via `notify()`; ➕ = to add.

Order lifecycle: order placed ✅ · requirements needed ➕ · order started ✅ · **delivered** ✅ ·
revision requested ✅ · **completed** ✅ · auto-complete warning ➕ · **review received** ✅ ·
**review request nudge** ➕ · custom offer received ✅ · custom offer accepted ✅ ·
**deadline reminders (2d/1d/due/overdue)** ➕ · cancellation/dispute + resolution ✅ ·
payout paid ✅ · gig approved/denied ➕ · seller level up/down ➕ · new message ✅ ·
saved-search new match ✅ · followed-seller new gig ✅ (digest).

## 6. Deadline reminders + review nudges (cron)

`Order.dueAt` already set at creation (pkg + extras delivery days). New nightly/hourly cron
`/api/cron/order-reminders`:
- IN_PROGRESS orders: 2 days / 1 day / due-today / overdue → seller (idempotent: one send per
  threshold, tracked via ActivityEvent or a `remindersSent` marker).
- DELIVERED &gt; ~24h and not reviewed → buyer review nudge.

## 7. Admin broadcast

`/admin/broadcast`: compose (single or per-locale) + audience filter (all / buyers / sellers /
active-30d) + live recipient count + send. Worker throttles ≤25 msg/s, honors 429 `retry_after`,
and on 403 marks the user bot-blocked (`telegramBlockedAt`) to skip on future sends. Audit-logged.
Runs via a CRON_SECRET job the admin action enqueues (single-instance throttled loop).

## 8. Build phases (each: build → adversarial review → deploy → verify → regression)

- **B1 Passwordless Mini App session** — `telegram-miniapp` Credentials bridge + Mini App
  bootstrap (loads telegram-web-app.js, auto signs-in via initData). Gate: open gigora.ai
  inside Telegram → logged in, no password; forged initData rejected.
- **B2 Bot launcher** — role-aware persistent reply keyboards + Menu Button + command/text
  router in the webhook (uz/ru/en). Gate: /start shows the right always-visible keyboard;
  buttons open the right Mini App screens.
- **B3 Notification catalog** — add the ➕ events to `notify()` with Telegram push. Gate:
  each lifecycle event yields the right in-app + Telegram notification, pref-gated.
- **B4 Deadline reminders + review nudges** — the cron + idempotent markers + workflow.
  Gate: an order near dueAt triggers exactly one 2d/1d/overdue reminder.
- **B5 Admin broadcast** — page + throttled sender + 403/429 handling + audit. Gate: test
  segment send; blocked users skipped; rate-safe.
- **B6 Messaging polish + Fiverr gaps** — quick-reply templates, block/report, online/last-seen,
  custom-offer-in-chat surfacing, bot-native quick reply. Gate: per feature.

## 9. Test plan (per phase)

- **Unit:** initData verify (valid/forged/stale) — extend existing telegram.test.ts;
  reminder threshold math; broadcast throttle/429 backoff; keyboard builder per role/locale.
- **Integration (prod verify-suite additions):** `/api/auth/telegram/miniapp` rejects bad
  initData (400/401); webhook `/start` still logs in; cron/order-reminders + cron/broadcast
  are CRON_SECRET-guarded (401 without); admin/broadcast guarded (307).
- **Manual (founder, in Telegram):** open bot → persistent keyboard visible → tap each button
  → correct Mini App screen, already logged in → send a message → arrives + notifies →
  place/deliver an order → lifecycle notifications land → receive a deadline reminder.
- **Regression:** every deploy runs the full existing suite (web login, admin guards, search,
  feed, health) so the bot work never regresses the platform.

## 10. Dependencies / gates
- Bot token + `TELEGRAM_WEBHOOK_SECRET` already set (login works today).
- BotFather: set Menu Button (or we set per-user via `setChatMenuButton`); optionally register
  command list. Founder action, small.
- No new third-party. All within the existing stack + gigora.ai Mini App.

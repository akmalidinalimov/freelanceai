# Analytics & user-management spec (Batch14)

What each role sees, where the numbers come from, and what admins can control.

## Data foundation
- `User.lastLoginAt` — stamped when a session is created (any provider).
- `User.lastSeenAt` — throttled per-request touch (≤1 write / 15 min / user) → powers
  the 3/7/14/30-day active-user windows.
- `User.telegramLastChatAt` — stamped by any inbound bot message (webhook).
- `ActivityEvent` — funnel events. Client-emitted (rate-limited, enum-validated via
  `POST /api/events`): `order_cta_click`, `contact_cta_click`. Server-written (trusted):
  `order_created`, `order_paid`. Clients can never forge conversions.
- Everything else derives from existing money-grade tables (Order, Transaction,
  LedgerEntry, PayoutRequest, Conversation, Message, Review) — no double bookkeeping.

## Admin — overview dashboard (/admin)
- Finance: GMV, platform revenue, ledger-integrity check (pre-existing).
- Totals: orders (by status), users, sellers, active gigs (pre-existing).
- **Activity**: active users 3/7/14/30d · registrations 24h/7d/30d · Telegram-linked ·
  KYC-verified · contacts (conversations) 7/30d · messages 7/30d.
- **Funnel (30d)**: order-CTA clicks → orders created → orders paid (+ conversion %),
  contact clicks → conversations started.

## Admin — user list (/admin/users)
Search + per-row: role, status, KYC, orders, sales, contacts, messages, last-seen age,
last-Telegram-chat age. Name links to the detail page.

## Admin — user detail (/admin/users/[id])
- Identity: email, decrypted KYC phone (admin boundary only), Telegram ID, masked payout
  card, locale, referrals; registered / last login / last seen / last TG chat.
- As buyer: total paid (succeeded PAYMENT_IN), payments count, sellers contacted, last
  order/contact dates, reviews written, orders by status.
- As seller: lifetime earned, withdrawable balance, payouts PAID (sum+count) vs
  REQUESTED (pending — i.e. "has the seller been paid or not"), gigs active/total,
  rating/level, buyer conversations, Instagram link + last sync, orders by status.
- Timeline: last 20 tracked events + last 20 audit actions.
- **Manage**: suspend/reactivate · make/remove seller · DELETE (typed confirmation;
  anonymize-and-close with the same guards as self-deletion). **ADMIN role is not
  grantable from any UI — allowlist-only via ADMIN_TELEGRAM_IDS (security invariant).**

## Seller dashboard additions
Earnings (held/available/lifetime — pre-existing) + views, orders, conversion, and NEW
30-day momentum: orders, completions, net revenue, new contacts.

## Buyer dashboard additions
Active orders, completed, total spent (real succeeded payments), sellers contacted,
saved gigs.

## Notes
- lastSeen throttle map is in-memory (single instance) — revisit if we scale out.
- ActivityEvent grows unbounded — add a retention cron (e.g. 180d) before high traffic.
- Windows are computed at request time (COUNT queries on indexed columns); move to
  materialized daily rollups when user counts make the tiles slow.

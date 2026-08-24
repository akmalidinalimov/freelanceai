# Worst-case scenarios, by actor

Each row is post-verification. **Live** = triggerable in the current production configuration (`PAYMENT_PROVIDER` empty, `FREE_ORDERS=1`, ~117 orders, one admin). **Armed** = the mechanism exists but a precondition is not met yet — almost always "a real payment provider is switched on".

An armed scenario is not a false alarm. It is a scenario with a known trigger date.

---

## Outsider (no account)

| Worst case | State | Cost to attacker | Payoff |
|---|---|---|---|
| Read or write every table via the Supabase Data API — `anon` holds full DML on all 44 tables and RLS is off | **Dev database only** | One anon key | The **development** database, not production: prod runs its own Postgres container with no published ports (`docker-compose.prod.yml:9`). Grants are confirmed by direct query; the REST reachability is unproven because this network cannot reach `supabase.com` |
| Phish a Telegram-registered user's session — forward a deep link, victim taps START in the real bot | **Live** | A delivery channel and one victim tap inside 5 minutes | Full account: inbox, PII, order control. No money moves (payouts are admin-settled and every balance is 0 under `FREE_ORDERS`) |
| Blackhole the Telegram bot for everyone — 121 messages/min exhausts a bucket keyed on *Telegram's* IP | **Live** | Trivial | 60s of dropped bot traffic for all users, self-healing. Every capability has a non-Telegram path |
| Restore the entire production database from the nightly dump | **Armed** — needs a leaked R2 token | Credential compromise | Every email, telegramId, real name, payout card, all private messages. The dump is unencrypted, in the same bucket the app serves user files from, contradicting `OPS-RUNBOOK.md` |
| Blind SSRF into the deployment network via `/api/me/portfolio` | **Live** | A free account + `intent:"sell"` | Blind only — `measureItem` is fire-and-forget with no oracle on the attacker's surface. Reconnaissance, not extraction |

## Buyer

| Worst case | State | Payoff |
|---|---|---|
| Order with a completely empty brief; the delivery clock starts anyway | **Live** | Seller works blind against a running deadline |
| One-tap "Order again" — unconfirmed, unpreviewed, at today's price with no brief | **Live** | Accidental purchases |
| Get refunded on paper but never in money — dispute writes a SUCCEEDED refund row, balances the ledger, and nothing leaves the platform | **Armed** | Buyer's only recourse is a chargeback. Exposure today is exactly zero: no buyer money has ever been collected |

## Seller

| Worst case | State | Payoff |
|---|---|---|
| **Self-approve any gig past moderation** — `action:"resume"` sets `ACTIVE` with no status precondition | **Live** | The moderation gate is optional. Anything can go live instantly |
| **Rewrite an approved gig wholesale** — title, description, images, price — keeping slug, ranking and reviews | **Live** | Bait-and-switch. Strictly dominated by the above (same actor, same root cause) |
| Skip the required Price step in the wizard, then fail publish with an error on an invisible step | **Live** | Lost work, confusion |

## Colluding pair (or one person with two accounts)

| Worst case | State | Cost | Payoff |
|---|---|---|---|
| **Manufacture unlimited 5★ reviews** — reviews check `COMPLETED`, never `isTest`; the loop is four free HTTP calls | **Live** | Zero | Fabricated reputation, Trending placement, leaderboard rank, badges — and it reaches Google rich results as structured data |
| Farm referral credit from a client-writable cookie holding a raw userId, no per-referrer cap, no referrer≠seller check | **Live** | Zero | Platform-funded credit |
| Mint withdrawable balance via tips with no funds collected | **Armed** — needs a non-test order | One real order | 10M UZS per call, 10 calls/min, cashed out via payout |
| Bank ~360 accounts/hour via Gmail plus-tags (`normalizeEmail` doesn't canonicalise) | **Armed** — the email sender is in sandbox mode, so links deliver nowhere | Zero once sandbox is lifted | Sybil supply for every other scenario above |

## Malicious or compromised admin

| Worst case | State | Notes |
|---|---|---|
| Operate a suspended or deleted account via impersonation, with every action **audit-logged as the victim** | **Live** | Real gap, but low: the same admin can already one-click "Reactivate", so no capability is gained. Audited, with a visible banner |
| Grant 200 × 10M UZS of credit in one bulk action — no daily ceiling, no second approver, no alert | **Live** | Only one admin id exists in production |
| Irreversibly anonymise a user while impersonating them; the audit row names the victim as the actor | **Live** | Forensically misleading rather than financially harmful |

## Operator error

| Worst case | State |
|---|---|
| Enable a PSP while `PAYME_KEY` is half-configured — `FREE_ORDERS` fails **open** and free ordering silently survives go-live | **Armed**, go-live day |
| `prisma migrate dev` drops `payme_active_txn_per_order` and `Gig_trendingScore_idx` — both exist in the live DB but are declared only in raw SQL | **Live risk**, one command away |
| Production re-seeds fabricated demo stats **on every deploy**, feeding the ranking model | **Live, happening now** |
| `ADMIN_TELEGRAM_IDS` missing → every admin silently and persistently demoted, with no audit row | **Live** |

# Gigora growth strategy — viral mechanics & affiliate design

Evidence-grounded brief (researcher pass, 2026-07). Context: Telegram-native (bot + Mini
App), price-sensitive UZ/Central-Asia market, trilingual (uz/ru/en), AI-creative output
(inherently shareable), and **credit-not-cash** rewards (cash payouts gated on the pending
PSP/bank agreement — see [reference-uz-payments-legal] / `docs/legal-uz-requirements.md`).

North-star metric for virality: **K-factor** = invites × conversion. K>1 compounds without
ad spend (Dropbox hit ~1.5–2.0). Credit is both the legally-safe *and* evidence-preferred
reward here — they point the same way (one exception: seller/creator cash, flagged below).

## Top 5 viral mechanics (ranked for Gigora)

1. **"Made with Gigora" watermarked shareable output** — every AI deliverable carries a
   tasteful badge + deferred deep link, with one-tap "share to Telegram/Instagram/TikTok" in
   the delivery flow. *The output is the ad* (how Canva/Loom/TikTok grew with ~no paid spend).
   Lever: virality + acquisition. Effort: **low–med**. **No cash, no fraud surface. Do first.**
2. **Telegram-native two-sided referral loop** — inviter + invitee both get **credit** on the
   invitee's first paid order. Two-sided beats one-sided (Shopify: 2.3× shares, 1.8× conv.);
   on Telegram this is the dominant engine (Notcoin: 35M users in 5 months, $0 ads). This is
   the **affiliate program** (design below). Lever: acquisition + virality. Effort: **med**.
3. **Creator-led growth** — recruit AI-creators who already have IG/TikTok/Telegram audiences
   *as sellers*; they arrive with demand attached (solves the marketplace cold-start). Airbnb's
   host-side referral was its most efficient channel. Lever: supply+demand acquisition. Effort:
   **med–high** (BD work; seller-affiliate payout hits the cash constraint — see flag).
4. **UGC challenges/contests** — themed monthly contests, community votes in Telegram, **credit**
   prizes + leaderboard status. Submissions are seeded portfolio content that also carry the #1
   watermark. Lever: activation + virality. Effort: **med** (ops-heavy, not eng).
5. **Seeded content + concierge kickstart** — manually seed supply + hand-match the first buyers
   in ONE niche (e.g. AI video ads for Tashkent SMBs). Not viral, but the **precondition** for
   #1–#4 to compound (a16z atomic-network). Effort: **high but time-limited**, mostly ops.

**Overrated (don't over-invest):** generic paid influencer shoutouts (non-compounding), badges
as an *acquisition* play (they help retention, not signups), tap-to-earn/crypto loops (attract
fraud + low-intent farmers, not buyers), and building the referral program *before* liquidity
exists (referrals amplify PMF, they don't create it — do #5 first).

## Affiliate program — recommended v1 design

Two-sided · credit-based · first-order-triggered · Telegram-native · trilingual.

| Element | v1 |
|---|---|
| Reward type | Platform **credit** only (legally safe; +25–40% LTV; forces on-platform activation) |
| Inviter reward | Credit ≈ **30–40% of Gigora's take-rate** on the referred user's first order, **capped** at a fixed so'm amount |
| Invitee reward ("get") | Fixed first-order credit (e.g. **50,000–100,000 so'm**) — removes price-risk of trying a first gig |
| Trigger | Invitee's **first completed, paid order** (never signup — fraud magnet) |
| Attribution | Inviter captured at signup via **Telegram deep-link referrer id**; first-order only; **30-day window** |
| Funding | 100% from **platform take-rate** (never the seller's cut); total reward capped below the referred user's expected take-rate contribution |
| Anti-fraud | KYC/OTP gate before credit unlocks (reuse existing Telegram/email verify); no self-referral (phone/TG-id/device/payment); ≤10 referrals/acct/month; velocity + device-cluster flags; **credit non-withdrawable** |
| Who can refer | Buyers→buyers **and** sellers→buyers at launch; creator→creator + seller lifetime rev-share in v2 once fraud data is clean |

We already have the **attribution rail** (`User.referralCode` / `referredById`, `/r/[code]`,
`applyReferral`) — signup attribution is done. v1 adds: a **promo-credit balance**, the
first-paid-order **trigger** that issues credit (from take-rate, idempotent, audited), credit
**redemption** at checkout, and the **anti-fraud** gates. Consider building credit on the
existing coupon/discount infra rather than a new e-money-like wallet.

## Sequencing (highest-ROI first)

1. **Watermark share loop (#1)** — cheapest, no fraud/cash, turns 100% of deliveries into
   distribution, measurable K-factor read in weeks. **First build.**
2. **Referral credit program (#2 / the affiliate design above)** — immediate second.
3. Do **#5 (seed one niche to liquidity)** in parallel — the loops only compound above it.

## Legal flags

- **Confirm with counsel** that non-withdrawable **promotional credit** (spendable only
  on-platform) is treated as a discount/marketing liability, **not e-money**. Likely fine, but
  it's the one novel money construct here.
- **Seller/creator cash commissions are BLOCKED** on the same licensed-PSP dependency as core
  payouts. Bridge with **fee waivers / commission holidays** on the referring seller's own
  future orders (economically like cash to them, but not a payout). Sequence cash-payout
  affiliate tiers after the PSP agreement.

Sources: Lenny's Newsletter (referrals), a16z Cold Start Problem, Dropbox/Uber/Airbnb case
studies, Shopify + Bloop reward-type data, Fiverr Affiliates (structure + fraud), impact.com
(fraud), TON Blog (Notcoin/Telegram virality), Canva/Loom/TikTok PLG. Full URLs in the session
research log. Regional (UZ AI-creative) data is analogical — first experiments are your primary data.

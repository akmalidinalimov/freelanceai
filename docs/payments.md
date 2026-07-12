# Payments, payouts, KYC & email — go-live guide

This document explains how money, verification, and email move through FreelanceAI,
and **exactly what to set to flip each one from the current manual/inert mode to live**.

Nothing here moves real money on its own. The adapters are written to each provider's
documented protocol but are **disabled until you supply credentials**, and the buyer
always pays on the provider's own hosted checkout — we only receive a signed webhook.

---

## 1. How settlement works today (manual, default)

1. Buyer places an order → status `PENDING_PAYMENT`.
2. Buyer pays the platform out-of-band (the order page shows "awaiting confirmation").
3. An **admin** clicks *Confirm payment* in `/admin/settlements` → `confirmOrderPayment()`
   posts the double-entry ledger and moves the order to `IN_PROGRESS`.
4. On completion, the seller's balance becomes withdrawable; an admin records a manual
   C2C payout in the same console (`recordPayout()`), pre-filled with the seller's saved
   payout card.

This path is unchanged when no PSP is configured. It is idempotent (a `Transaction`
row keyed `order:<id>:payment-in` prevents double-posting).

---

## 2. Turning on a PSP (Payme or Click)

Both providers share one interface (`src/lib/payments/`). The buyer is redirected to the
provider's checkout; the provider then calls our webhook, which calls the **shared**
`settleOrderByProvider()` — the same ledger posting as the manual flow, idempotent.

Select a provider with `PAYMENT_PROVIDER=payme` **or** `PAYMENT_PROVIDER=click`.

### Payme (Paycom Merchant API — JSON-RPC, amounts in tiyin)

| Env var | Value |
|---|---|
| `PAYMENT_PROVIDER` | `payme` |
| `PAYME_MERCHANT_ID` | Cashbox / merchant id from your Payme business cabinet |
| `PAYME_KEY` | The cashbox **key** (used to verify the `Authorization: Basic` header) |
| `PAYME_CHECKOUT_URL` | optional; default `https://checkout.paycom.uz` |

- **Webhook URL to register in Payme:** `https://<your-domain>/api/payments/payme`
- Methods handled: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`,
  `CancelTransaction`, `CheckTransaction`.
- ⚠️ **Certify against Payme's sandbox test-suite before go-live.** Payme runs an
  automated conformance test against your endpoint; pass it on their sandbox first.

### Click (Shop API — Prepare/Complete, MD5-signed, amounts in soʻm)

| Env var | Value |
|---|---|
| `PAYMENT_PROVIDER` | `click` |
| `CLICK_SERVICE_ID` | Service id from your Click merchant cabinet |
| `CLICK_MERCHANT_ID` | Merchant id |
| `CLICK_SECRET_KEY` | Secret key (used to verify the `sign_string` MD5) |
| `CLICK_CHECKOUT_URL` | optional; default `https://my.click.uz/services/pay` |

- **Webhook URL to register in Click:** `https://<your-domain>/api/payments/click`
  (used for both Prepare `action=0` and Complete `action=1`).
- ⚠️ **Certify against Click's merchant sandbox before go-live.**

> **Legal gate (do not skip):** real PSP credentials only exist after a signed
> PSP/bank agent agreement. Per the build plan, automated escrow/payouts also need
> local fintech counsel sign-off (Phase 12). Keep `PAYMENT_PROVIDER` unset until then.

---

## 3. KYC

- Users enter a **phone number** in `/dashboard/settings`; saving it moves
  `kycStatus` `NONE → PENDING`. (Phone OTP verification needs an SMS provider — not yet
  wired; an admin/manual step sets `VERIFIED` for now.)
- Sellers save a **payout card** in the same page — only the **masked** form (last 4
  digits) is stored; the full PAN is never persisted.

---

## 4. Email

Already a working Resend adapter (`src/lib/email.ts`), inert until configured:

| Env var | Value |
|---|---|
| `RESEND_API_KEY` | API key from resend.com (or swap the adapter for Postmark/SES) |
| `EMAIL_FROM` | e.g. `FreelanceAI <noreply@your-verified-domain>` |

**You must verify the sending domain** (add the DNS records Resend gives you) before
mail is delivered. Notifications use branded HTML (`renderBrandedEmail`) with a text
fallback. Until the key is set, email is a logged no-op — the rest of the app is
unaffected.

---

## 5. Pre-go-live checklist

- [ ] Signed PSP/bank agent agreement + fintech counsel sign-off (Phase 12)
- [ ] Payme **or** Click sandbox conformance passed
- [ ] `PAYMENT_PROVIDER` + that provider's creds set on the VPS env
- [ ] Webhook URL registered in the provider cabinet
- [ ] `RESEND_API_KEY` + `EMAIL_FROM` set and sending domain verified
- [ ] One real low-value end-to-end test order (pay → webhook → ledger → payout)
- [ ] Confirm the ledger nets to zero after the test (admin dashboard integrity check)

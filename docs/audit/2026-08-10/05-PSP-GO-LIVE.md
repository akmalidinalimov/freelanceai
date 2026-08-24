# PSP go-live checklist

Payme/Click integration is **deferred**. This is the gate to work top to bottom before `PAYMENT_PROVIDER` is ever set.

Every item below is a real defect found in the audit, not a precaution. They are dormant because both providers are inert: `verifyPaymeAuth` requires a non-empty `PAYME_KEY` and `verifyClickSign` returns false when `CLICK_SECRET_KEY` is unset — and both are empty. Nothing here is urgent today. All of it is urgent the hour a provider is enabled.

---

## Blockers — a real payment cannot be accepted safely until these are done

**1. Webhooks must not report success when no settlement happened.**
`settleOrderByProvider` returns void and silently no-ops when the order has left `PENDING_PAYMENT` (`payments.ts:131`). Payme's `PerformTransaction` (`payme.ts:133`) then marks the transaction SUCCEEDED and replies `state:2`; Click's Complete (`click.ts:116`) replies `error:OK`. A buyer who pays after their order expires gets charged, and the platform confirms the charge as good and does nothing with it.
*Fix:* make `settleOrderByProvider` return a discriminated result (`settled` / `already-settled` / `order-not-payable`) and have both adapters map a non-settlement to the provider's error code so the PSP does not capture. Add the "already processed" guard to Click's Complete branch, which today has it only on Prepare.

**2. Build an outbound refund path.**
Dispute refunds (`dispute.ts:83`) and mutual cancellations (`cancellation.ts:71`) write `Transaction{type:REFUND, provider:MANUAL, status:SUCCEEDED}` and post reversal entries that balance the ledger — asserting the buyer was made whole. Nothing in `src/lib/payments/` calls any provider refund API, and no admin surface lists refunds owed.
*Fix:* add a `refunds-owed` queue to `/admin/settlements` (mirroring the payout-request queue) and, at minimum, a manual "mark refunded" action with proof-of-transfer. A provider refund API call is better where the PSP supports it. Refund rows must not be written as `SUCCEEDED` before the money actually moves.

**3. Stop tips minting balance from nothing.**
`tipOrder` writes `provider:"MANUAL", status:"SUCCEEDED"` unconditionally (`payments.ts:342`) with no charge, and `sellerTipsTotal` feeds it straight into withdrawable balance. Order payments require admin confirmation; tips self-confirm.
*Fix:* route tips through the same settlement path as orders, or hold them as `PENDING` until a real charge confirms.

**4. Close the `FREE_ORDERS` fail-open.**
`freeOrdersEnabled()` is `FREE_ORDERS==="1" && !paymentsEnabled()` (`payments.ts:283`). A half-configured provider counts as "not enabled", so free ordering silently survives go-live.
*Fix:* fail closed — if `PAYMENT_PROVIDER` names any provider, refuse to boot when that provider's credentials are incomplete, rather than falling back to free orders.

**5. Payme writes two SUCCEEDED `PAYMENT_IN` rows per payment** (`payme.ts:134`), double-counting outside the ledger. Reconciliation and any revenue report built on `Transaction` will be wrong.

**6. Click records no `providerTxnId` and has no reversal path.** There is no reconciliation trail for Click and no handler for a Click-side chargeback, so a reversed payment leaves the seller credited. Also verify `service_id` against `CLICK_SERVICE_ID` — it is currently used in the signature but never compared.

**7. Move the delivery clock to payment, not order creation.** `dueAt` is computed at `createOrder` (`order.ts:114`). With a real PSP there is a gap of up to 48h between placing and paying, and the seller loses all of it from every deadline.

---

## Required before the first real payout

**8. KYC-gate payouts.** `requestPayout` (`payments.ts:549`) checks `isSeller` and balance, never `kycStatus`. The published Terms say payouts are KYC-gated. Today the contradiction is harmless; with real money it is a compliance problem.

**9. Add a uniqueness constraint on `(sellerId)` where `status='REQUESTED'`.** `requestPayout` is an unguarded check-then-create, so duplicate REQUESTED rows are permanently possible. A partial unique index is the right fix — and it must be declared in a migration *and* accounted for in the drift check below.

**10. Enforce `requireActive` on money routes.** `/api/me/payout` checks `isSeller` but never status, and `requireActive` is only reachable via `requireSeller`, which these routes do not call.

---

## Reconciliation and safety net

**11. Ledger-vs-order reconciliation must be a test, not a dashboard panel.** `analytics.ts:239` computes `ledgerImbalanced` at runtime but nothing asserts `Σ LedgerEntry = 0` per order across a full lifecycle including dispute-refund and cancellation. Add it to the integration suite.

**12. Protect the raw-SQL indexes from schema regeneration.** `payme_active_txn_per_order` is the atomic double-charge guard and exists only in a migration, invisible to `schema.prisma`. It is present in the live DB today, but `prisma migrate dev` would generate a drop. Add a CI assertion that both it and `Gig_trendingScore_idx` exist after migrate.

**13. Turn off the demo-stats seeder in production** before real orders exist, or ranking will mix fabricated and real volume.

**14. Add error tracking.** Going live with real money and no production error visibility means the first sign of a payment bug will be a user complaint.

---

## Verification before flipping the switch

- Run the full integration suite against a real Postgres, including new tests for items 1, 2, 3 and 11.
- Drive both webhooks end to end in a staging environment: settle, double-settle, settle-after-expiry, cancel-after-perform, and a replayed Complete.
- Confirm `freeOrdersEnabled()` returns false and that a deliberately half-configured provider refuses to boot.
- Confirm a refund moves money and appears in the admin queue.

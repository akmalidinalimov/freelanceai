-- Enforce "at most one ACTIVE Payme transaction per order" at the DB level, so the P1
-- double-charge guard in the Payme adapter is atomic instead of a check-then-create TOCTOU
-- (two concurrent CreateTransaction calls with different Payme ids could both pass a
-- findFirst and both create — Payme would then believe two card charges succeeded).
--
-- Scoped to providerTxnId IS NOT NULL so it covers ONLY the adapter's own txn rows and NOT
-- the settlement row that postOrderPaymentTx writes (providerTxnId = NULL) — otherwise the
-- two PAYME PAYMENT_IN rows a settled order legitimately has would collide. Active = the
-- states in which a charge is outstanding or captured; CANCELLED/FAILED are excluded so the
-- normal Payme "cancel then retry with a new id" flow still works.
CREATE UNIQUE INDEX IF NOT EXISTS "payme_active_txn_per_order"
ON "Transaction" ("orderId")
WHERE provider = 'PAYME'
  AND "providerTxnId" IS NOT NULL
  AND "orderId" IS NOT NULL
  AND status IN ('PENDING', 'SUCCEEDED');

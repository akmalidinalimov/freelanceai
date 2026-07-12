-- Mark free "test mode" orders so they're excluded from all economic aggregation
-- (payout balances, referral rewards, public seller stats). Additive + defaulted = safe.
ALTER TABLE "Order" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

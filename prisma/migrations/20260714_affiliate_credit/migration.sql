-- Affiliate credit: spendable promo/referral credit + first-order reward ledger.
ALTER TABLE "User" ADD COLUMN "creditBalanceUzs" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountUzs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralReward_refereeId_key" ON "ReferralReward"("refereeId");
CREATE INDEX "ReferralReward_referrerId_idx" ON "ReferralReward"("referrerId");

ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

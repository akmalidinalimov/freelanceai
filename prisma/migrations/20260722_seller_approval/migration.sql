-- Seller approval gate (2026-07-09).
-- New sellers start INCOMPLETE and are invisible publicly until an admin APPROVES.
-- EXISTING sellers are grandfathered to APPROVED so the live marketplace does not
-- vanish the moment this ships.

CREATE TYPE "SellerApprovalStatus" AS ENUM ('INCOMPLETE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "SellerProfile"
  ADD COLUMN "approvalStatus" "SellerApprovalStatus" NOT NULL DEFAULT 'INCOMPLETE',
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

-- Grandfather every seller that already exists at deploy time.
UPDATE "SellerProfile" SET "approvalStatus" = 'APPROVED', "approvedAt" = now();

CREATE INDEX "SellerProfile_approvalStatus_idx" ON "SellerProfile"("approvalStatus");

-- Included revisions were shown on every package and enforced nowhere: requestRevision checked
-- only the state machine, so a buyer could request revisions without limit while the seller had
-- agreed to a fixed number. Snapshot the allowance on the order (packages can change later) and
-- count usage.
ALTER TABLE "Order" ADD COLUMN "revisionsIncluded" INTEGER;
ALTER TABLE "Order" ADD COLUMN "revisionsUsed" INTEGER NOT NULL DEFAULT 0;

-- Backfill the allowance for existing orders from the package they were placed on. Orders whose
-- gig or package no longer exists stay NULL and remain unenforced rather than getting an
-- invented limit applied retroactively.
UPDATE "Order" o
SET "revisionsIncluded" = p."revisions"
FROM "GigPackage" p
WHERE p."gigId" = o."gigId" AND p."tier" = o."packageTier";

-- Orders already past a revision have used at least one; don't hand them a fresh allowance.
UPDATE "Order" SET "revisionsUsed" = 1
WHERE "status" = 'REVISION' AND "revisionsUsed" = 0;

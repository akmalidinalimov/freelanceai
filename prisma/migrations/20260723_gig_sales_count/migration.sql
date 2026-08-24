-- Display order-count for pre-launch DEMO gigs. Additive + defaulted = safe.
-- Real gigs keep 0 and show their true order count; demo gigs get a fabricated
-- value via seed-demo-stats. DEMO-ONLY — reset before real launch.
ALTER TABLE "Gig" ADD COLUMN "salesCount" INTEGER NOT NULL DEFAULT 0;

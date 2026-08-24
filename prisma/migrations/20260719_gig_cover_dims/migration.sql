-- Native cover dimensions so covers render at their true aspect ratio (no forced crop).
-- Additive + nullable = safe; existing gigs stay NULL and fall back to fixed-frame + focal.
ALTER TABLE "Gig" ADD COLUMN "coverW" INTEGER;
ALTER TABLE "Gig" ADD COLUMN "coverH" INTEGER;

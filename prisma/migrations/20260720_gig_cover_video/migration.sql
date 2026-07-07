-- Gig cover can be a 16:9 image OR a short horizontal video banner.
-- Additive + nullable/defaulted = safe; existing gigs default to image.
ALTER TABLE "Gig" ADD COLUMN "coverType" TEXT DEFAULT 'image';
ALTER TABLE "Gig" ADD COLUMN "coverPosterUrl" TEXT;

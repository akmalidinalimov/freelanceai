-- AI CREATORS course graduates: admin-tagged trust signal (featured ranking + badge).
ALTER TABLE "User" ADD COLUMN "isCourseStudent" BOOLEAN NOT NULL DEFAULT false;

-- Per-gig portfolio evidence: a public Telegram channel and/or Instagram handle for
-- THIS service (uploaded media already lives in Gig.galleryUrls).
ALTER TABLE "Gig" ADD COLUMN "portfolioTelegram" TEXT;
ALTER TABLE "Gig" ADD COLUMN "portfolioInstagram" TEXT;

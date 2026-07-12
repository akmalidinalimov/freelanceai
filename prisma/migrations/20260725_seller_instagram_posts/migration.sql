-- No-API Instagram portfolio: the seller's chosen public post/reel links, embedded on their
-- profile via Instagram's /embed iframe (no Meta App Review needed). Additive + defaulted = safe.
ALTER TABLE "SellerProfile" ADD COLUMN "instagramPosts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

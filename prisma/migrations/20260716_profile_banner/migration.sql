-- Profile hero banner: uploaded image or short showreel video (+ poster frame).
ALTER TABLE "SellerProfile" ADD COLUMN "bannerUrl" TEXT;
ALTER TABLE "SellerProfile" ADD COLUMN "bannerType" TEXT;
ALTER TABLE "SellerProfile" ADD COLUMN "bannerPosterUrl" TEXT;

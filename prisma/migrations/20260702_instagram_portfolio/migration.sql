-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "instagramSyncStatus" TEXT,
ADD COLUMN     "instagramSyncedAt" TIMESTAMP(3),
ADD COLUMN     "instagramTokenEnc" TEXT,
ADD COLUMN     "instagramTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "instagramUserId" TEXT;

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "permalink" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'upload';

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_profileId_externalId_key" ON "PortfolioItem"("profileId", "externalId");


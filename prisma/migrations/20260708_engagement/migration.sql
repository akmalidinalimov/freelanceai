-- Engagement: trending score on gigs + weekly creator leaderboard snapshots.
ALTER TABLE "Gig" ADD COLUMN "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX "Gig_trendingScore_idx" ON "Gig"("trendingScore");

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "completed" INTEGER NOT NULL,
    "ratingAvg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_weekStart_sellerId_key" ON "LeaderboardEntry"("weekStart", "sellerId");
CREATE INDEX "LeaderboardEntry_weekStart_rank_idx" ON "LeaderboardEntry"("weekStart", "rank");

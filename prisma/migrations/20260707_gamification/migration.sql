-- Gamification: XP/streaks on User (cosmetic, non-monetary) + earned badges.
ALTER TABLE "User" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "streakDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "streakBest" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastActiveDay" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_key_key" ON "UserBadge"("userId", "key");
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

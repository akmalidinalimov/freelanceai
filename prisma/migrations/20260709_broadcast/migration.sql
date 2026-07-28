-- Admin broadcast + bot-blocked marker.
ALTER TABLE "User" ADD COLUMN "telegramBlockedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('ALL', 'BUYERS', 'SELLERS', 'ACTIVE_30D');
CREATE TYPE "BroadcastStatus" AS ENUM ('PENDING', 'SENDING', 'DONE');

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'PENDING',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broadcast_status_idx" ON "Broadcast"("status");

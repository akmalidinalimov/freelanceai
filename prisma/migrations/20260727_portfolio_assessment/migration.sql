-- Technical metadata for the free (L0) portfolio quality gate.
ALTER TABLE "PortfolioItem" ADD COLUMN "width" INTEGER;
ALTER TABLE "PortfolioItem" ADD COLUMN "height" INTEGER;
ALTER TABLE "PortfolioItem" ADD COLUMN "bytes" INTEGER;
ALTER TABLE "PortfolioItem" ADD COLUMN "phash" TEXT;
ALTER TABLE "PortfolioItem" ADD COLUMN "analyzedAt" TIMESTAMP(3);
CREATE INDEX "PortfolioItem_phash_idx" ON "PortfolioItem"("phash");

-- One assessment run per seller (L0 deterministic + optional Gemini review).
CREATE TABLE "PortfolioAssessment" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'l0',
    "l0Score" INTEGER NOT NULL,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsPassed" INTEGER NOT NULL DEFAULT 0,
    "craft" INTEGER,
    "commercialUse" INTEGER,
    "coherence" INTEGER,
    "specMatch" INTEGER,
    "overall" INTEGER,
    "verdict" TEXT,
    "reasons" JSONB,
    "model" TEXT,
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PortfolioAssessment_sellerId_createdAt_idx" ON "PortfolioAssessment"("sellerId", "createdAt");
ALTER TABLE "PortfolioAssessment" ADD CONSTRAINT "PortfolioAssessment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

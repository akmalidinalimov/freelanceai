-- S2 semantic search. Requires the pgvector-enabled db image (deploy/db.Dockerfile);
-- CREATE EXTENSION is idempotent and runs as the cluster superuser (compose db user).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "SellerEmbedding" (
    "sellerId" TEXT NOT NULL,
    "docText" TEXT NOT NULL,
    "embedding" vector(1024),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerEmbedding_pkey" PRIMARY KEY ("sellerId")
);

-- AddForeignKey
ALTER TABLE "SellerEmbedding" ADD CONSTRAINT "SellerEmbedding_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- kNN index (cosine). HNSW: fast reads, fine with per-row writes from the rebuild job.
CREATE INDEX "SellerEmbedding_embedding_idx" ON "SellerEmbedding" USING hnsw ("embedding" vector_cosine_ops);

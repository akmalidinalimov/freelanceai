-- Inbox ordering. listInbox fetched `take: 50` with NO orderBy, so Postgres returned an
-- arbitrary 50 conversations and only those were sorted (in JS) by last-message time. A
-- freelancer with more than 50 threads could therefore never see a brand-new buyer enquiry,
-- and the JS sort made the truncated list still look correctly ordered.
--
-- There is no column to sort by (a message's time lives on Message, and sending one did not
-- touch Conversation), so denormalize it.
ALTER TABLE "Conversation"
  ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: newest message in the thread, falling back to when the thread was opened.
UPDATE "Conversation" c
SET "lastActivityAt" = COALESCE(
  (SELECT MAX(m."createdAt") FROM "Message" m WHERE m."conversationId" = c."id"),
  c."createdAt"
);

CREATE INDEX "Conversation_lastActivityAt_idx" ON "Conversation"("lastActivityAt");

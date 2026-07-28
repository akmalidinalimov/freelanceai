-- Bot-native quick reply: map a bot notification message → conversation.
-- CreateTable
CREATE TABLE "TelegramReplyTarget" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "messageId" BIGINT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramReplyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramReplyTarget_telegramId_messageId_key" ON "TelegramReplyTarget"("telegramId", "messageId");
CREATE INDEX "TelegramReplyTarget_conversationId_idx" ON "TelegramReplyTarget"("conversationId");
CREATE INDEX "TelegramReplyTarget_createdAt_idx" ON "TelegramReplyTarget"("createdAt");

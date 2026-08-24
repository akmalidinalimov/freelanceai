-- Telegram-channel portfolio: optional channel handle + list of public post links
-- (t.me/<channel>/<id>) embedded on the creator profile as live Telegram posts.
ALTER TABLE "SellerProfile" ADD COLUMN "telegramChannel" TEXT;
ALTER TABLE "SellerProfile" ADD COLUMN "telegramPosts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

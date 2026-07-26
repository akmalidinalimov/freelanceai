-- Bot-native onboarding: which free-input step (name / portfolio) the Telegram bot
-- conversation is waiting on for this user. Null = not mid-conversation.
ALTER TABLE "User" ADD COLUMN "botOnboardStep" TEXT;

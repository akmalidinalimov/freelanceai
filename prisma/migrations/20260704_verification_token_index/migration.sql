-- CreateIndex (magic-link login consumes VerificationToken by token alone)
CREATE INDEX IF NOT EXISTS "VerificationToken_token_idx" ON "VerificationToken"("token");

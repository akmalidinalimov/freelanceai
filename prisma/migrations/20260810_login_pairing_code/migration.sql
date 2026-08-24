-- Telegram deep-link login was confirmable without consent: the bot flipped a token to
-- CONFIRMED the instant it saw `/start <token>`, and the browser-nonce binding ties the
-- session to whoever CALLED /start — the attacker, in a forwarded-link attack. A victim
-- tapping START in the genuine bot therefore authenticated the attacker's browser.
--
-- The fix needs a value the victim can only have seen on their own screen, so add a pairing
-- code shown both on the login page and in the bot's confirm prompt. Locale rides along so
-- that prompt is not hardcoded Uzbek for ru/en users.
ALTER TABLE "LoginToken" ADD COLUMN "pairingCode" TEXT;
ALTER TABLE "LoginToken" ADD COLUMN "locale" TEXT;

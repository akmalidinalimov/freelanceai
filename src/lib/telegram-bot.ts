import "server-only";

/**
 * Thin client for the Telegram Bot API. Server-only (uses the bot token).
 * Used by the bot deep-link login flow (webhook + sendMessage) and webhook setup.
 */

function api(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function tgSendMessage(chatId: number | string, text: string): Promise<void> {
  try {
    await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("tgSendMessage failed", err);
  }
}

/** Register the webhook (called once during setup). */
export async function tgSetWebhook(url: string, secretToken: string): Promise<unknown> {
  const res = await fetch(api("setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secretToken,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });
  return res.json();
}

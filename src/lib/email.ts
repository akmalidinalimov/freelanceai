import "server-only";

/**
 * Email delivery. Uses Resend when RESEND_API_KEY is set; otherwise logs a no-op so the
 * notification path works end-to-end and real email "just works" once a provider is
 * configured (sign up for Resend/Postmark/SES → set RESEND_API_KEY + EMAIL_FROM). Best-effort.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "FreelanceAI <noreply@aicreator.academy>";
  if (!key) {
    console.log(`[email:noop] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
  } catch (err) {
    console.error("sendEmail failed", err);
  }
}

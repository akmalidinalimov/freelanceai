import "server-only";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Email delivery. Uses Resend when RESEND_API_KEY is set; otherwise logs a no-op so the
 * notification path works end-to-end and real email "just works" once a provider is
 * configured (sign up for Resend/Postmark/SES → set RESEND_API_KEY + EMAIL_FROM). Best-effort.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? `${BRAND_NAME} <noreply@aicreator.academy>`;
  if (!key) {
    console.log(`[email:noop] to=${to} subject="${subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) console.error("sendEmail rejected", res.status);
    return res.ok;
  } catch (err) {
    console.error("sendEmail failed", err);
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface BrandedEmail {
  title: string;
  lines: string[];
  button?: { label: string; url: string };
}

/**
 * Render a branded FreelanceAI email into both plain-text and inline-styled HTML
 * (table layout + inline CSS for broad client support). Returns both so `sendEmail`
 * can carry a text fallback alongside the HTML.
 */
export function renderBrandedEmail({ title, lines, button }: BrandedEmail): { text: string; html: string } {
  const text = [title, "", ...lines, button ? `\n${button.label}: ${button.url}` : ""].join("\n").trim();

  const body = lines
    .map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${escapeHtml(l)}</p>`)
    .join("");

  const cta = button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 4px"><tr><td style="border-radius:8px;background:#14a37f">
         <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(button.label)}</a>
       </td></tr></table>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
      <tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
        <span style="font-size:18px;font-weight:700;color:#14a37f">${BRAND_NAME}</span>
      </td></tr>
      <tr><td style="padding:26px 28px">
        <h1 style="margin:0 0 14px;font-size:19px;color:#0f172a">${escapeHtml(title)}</h1>
        ${body}${cta}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
        ${BRAND_NAME} — Central Asia's marketplace for AI creators
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { text, html };
}

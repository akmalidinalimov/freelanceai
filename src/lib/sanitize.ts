/**
 * Off-platform contact-info stripping (anti-escrow-bypass, spec C2). Pure → unit-tested.
 * Redacts emails, URLs/domains, phone numbers, and messaging handles so buyers/sellers
 * can't move the deal off-platform via chat or gig text. Conservative on bare numbers so
 * prices (UZS) aren't mistaken for phone numbers.
 */
const REDACTION = "[hidden]";

const PATTERNS: RegExp[] = [
  // emails
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi,
  // explicit URLs
  /\b(?:https?:\/\/|www\.)\S+/gi,
  // bare domains with a known TLD
  /\b[\w-]+\.(?:com|net|org|io|me|co|app|dev|uz|ru|info|biz|tg|link|site|online|store)\b/gi,
  // phone numbers: require a leading + OR 10+ digits total (so 6–7 digit prices are safe)
  /(?:\+\d[\d\s().-]{7,}\d)|(?:\b\d[\d\s().-]{9,}\d\b)/g,
  // messaging handles + app keywords
  /@[A-Za-z][\w]{2,}/g,
  /\b(?:t\.me|telegram|telegramm|whatsapp|whats app|viber|imo|signal)\b/gi,
];

export function stripContactInfo(input: string): { text: string; redacted: boolean } {
  let redacted = false;
  let out = input;
  for (const re of PATTERNS) {
    out = out.replace(re, () => {
      redacted = true;
      return REDACTION;
    });
  }
  return { text: out, redacted };
}

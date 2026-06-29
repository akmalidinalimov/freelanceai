import { describe, it, expect } from "vitest";
import { stripContactInfo } from "./sanitize";

describe("stripContactInfo", () => {
  it("redacts emails", () => {
    const r = stripContactInfo("write me at john.doe@gmail.com please");
    expect(r.redacted).toBe(true);
    expect(r.text).not.toContain("gmail.com");
  });

  it("redacts URLs and bare domains", () => {
    expect(stripContactInfo("see https://example.com/x").text).not.toContain("example.com");
    expect(stripContactInfo("go to www.site.uz now").text).not.toContain("site.uz");
    expect(stripContactInfo("my portfolio is behance.net").redacted).toBe(true);
  });

  it("redacts phone numbers (with + or 10+ digits)", () => {
    expect(stripContactInfo("call +998 90 123 45 67").text).not.toMatch(/\d{3}/);
    expect(stripContactInfo("number 9981234567890").redacted).toBe(true);
  });

  it("redacts handles and messaging apps", () => {
    expect(stripContactInfo("dm @cooluser").text).not.toContain("@cooluser");
    expect(stripContactInfo("find me on Telegram").redacted).toBe(true);
    expect(stripContactInfo("whatsapp me").redacted).toBe(true);
  });

  it("does NOT redact prices or ordinary text", () => {
    const price = stripContactInfo("narxi 500000 so'm, 1500000 premium");
    expect(price.redacted).toBe(false);
    expect(price.text).toContain("500000");

    const normal = stripContactInfo("Professional 4K AI video, Node.js explainer in 3 days");
    expect(normal.redacted).toBe(false);
    expect(normal.text).toBe("Professional 4K AI video, Node.js explainer in 3 days");
  });

  it("leaves clean messages untouched", () => {
    const clean = "Salom! Men sizga reklama videosi kerak edi.";
    const r = stripContactInfo(clean);
    expect(r.redacted).toBe(false);
    expect(r.text).toBe(clean);
  });
});

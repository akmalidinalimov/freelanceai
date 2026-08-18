/**
 * Proves the Mini App session fix on production.
 *
 * Telegram Desktop and Telegram Web run a Mini App in an iframe on telegram.org, so gigora.ai is
 * cross-site there. With the old SameSite=Lax cookies it received NOTHING back, which is why a
 * signed-in user was asked to log in again on every launch. This frames the real site from the
 * real telegram.org origin and checks the marker cookie now survives that trip.
 *
 * Usage: node deploy/verify-miniapp-cookies.mjs [origin]
 */
import { chromium } from "playwright";

const ORIGIN = process.argv[2] ?? "https://gigora.ai";
const fail = [];
const check = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) fail.push(name);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 1. A Mini App launch must issue a marker cookie that is cross-site capable and persistent.
await page.goto(`${ORIGIN}/uz/?tgapp=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const marker = (await ctx.cookies(ORIGIN)).find((c) => c.name === "gigora_tgapp");
check("marker cookie is set", Boolean(marker), marker ? "present" : "missing");
if (marker) {
  check("marker is SameSite=None", marker.sameSite === "None", `sameSite=${marker.sameSite}`);
  check("marker is Secure", marker.secure === true, `secure=${marker.secure}`);
  const days = marker.expires > 0 ? Math.round((marker.expires - Date.now() / 1000) / 86400) : 0;
  check("marker survives a relaunch", days >= 25, days ? `expires in ${days}d` : "SESSION COOKIE");
}

// 2. The decisive one: framed from telegram.org, do our cookies actually arrive?
let cookieHeader = "";
await page.route(`${ORIGIN}/uz/**`, async (route) => {
  const req = route.request();
  if (req.resourceType() === "document" && req.frame() !== page.mainFrame()) {
    cookieHeader = req.headers()["cookie"] ?? "";
  }
  await route.continue();
});
await page.goto("https://web.telegram.org/k/", { waitUntil: "domcontentloaded" });
await page.evaluate((o) => {
  const f = document.createElement("iframe");
  f.src = `${o}/uz/`;
  document.body.appendChild(f);
}, ORIGIN);
await page.waitForTimeout(5000);

check(
  "cookies reach gigora.ai inside Telegram's iframe",
  cookieHeader.includes("gigora_tgapp"),
  cookieHeader ? `Cookie: ${cookieHeader.slice(0, 90)}` : "NO Cookie header — session cannot persist"
);

// 3. Telegram must still be allowed to frame us at all.
const res = await page.request.get(`${ORIGIN}/uz/`);
const csp = res.headers()["content-security-policy"] ?? "";
check("CSP still permits telegram.org to frame us", /frame-ancestors[^;]*telegram\.org/.test(csp));

await browser.close();
console.log(`\n${fail.length ? `FAILED: ${fail.join(", ")}` : "ALL PASS — a Mini App session can persist"}`);
process.exit(fail.length ? 1 : 0);

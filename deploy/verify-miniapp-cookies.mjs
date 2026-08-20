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

// 1. The server must emit a cross-site-capable, persistent marker cookie.
const launch = await page.request.get(`${ORIGIN}/uz?tgapp=1`, { maxRedirects: 0 });
const setCookie = (launch.headersArray().find((h) => h.name.toLowerCase() === "set-cookie") || {}).value ?? "";
check("marker cookie is issued", setCookie.includes("gigora_tgapp="), setCookie || "no Set-Cookie");
check("marker is SameSite=None", /samesite=none/i.test(setCookie));
check("marker is Secure", /;\s*Secure/i.test(setCookie));
check("marker is Partitioned (CHIPS)", /Partitioned/i.test(setCookie));
check("marker survives a relaunch", /Max-Age=\d{6,}/i.test(setCookie), /Max-Age=\d+/i.exec(setCookie)?.[0]);

// 2. The decisive one, replicating what Telegram actually does.
//
// A Partitioned cookie is keyed to the TOP-LEVEL site, so one set while gigora.ai is top-level is
// correctly invisible under telegram.org — testing it that way measures nothing. Telegram launches
// the Mini App INSIDE the iframe, so the cookie must be set there and then survive to the next
// framed request under the same top-level site. That is the property a session depends on.
await page.goto("https://web.telegram.org/k/", { waitUntil: "domcontentloaded" });

const frameTo = (path) =>
  page.evaluate(
    ([o, p]) =>
      new Promise((resolve) => {
        const f = document.createElement("iframe");
        f.src = `${o}${p}`;
        f.onload = () => resolve(true);
        document.body.appendChild(f);
        setTimeout(() => resolve(false), 15000);
      }),
    [ORIGIN, path]
  );

let secondVisitCookies = "";
await page.route(`${ORIGIN}/uz/gigs**`, async (route) => {
  const req = route.request();
  if (req.resourceType() === "document") secondVisitCookies = req.headers()["cookie"] ?? "";
  await route.continue();
});

await frameTo("/uz?tgapp=1"); // the real launch, inside Telegram's frame
await page.waitForTimeout(2500);
await frameTo("/uz/gigs"); // a later launch / navigation in the same context
await page.waitForTimeout(2500);

check(
  "the marker survives to the next launch inside Telegram's iframe",
  secondVisitCookies.includes("gigora_tgapp"),
  secondVisitCookies ? `Cookie: ${secondVisitCookies.slice(0, 100)}` : "NO Cookie header — a session cannot persist"
);

// 3. Telegram must still be allowed to frame us at all.
const res = await page.request.get(`${ORIGIN}/uz/`);
const csp = res.headers()["content-security-policy"] ?? "";
check("CSP still permits telegram.org to frame us", /frame-ancestors[^;]*telegram\.org/.test(csp));

await browser.close();
console.log(`\n${fail.length ? `FAILED: ${fail.join(", ")}` : "ALL PASS — a Mini App session can persist"}`);
process.exit(fail.length ? 1 : 0);

// Deep end-to-end sweep of the live PUBLIC + API surface (no auth). Complements smoke-test.mjs
// with content assertions + real search/filters/SEO. Run: node deploy/e2e-prod.mjs
const B = (process.argv[2] ?? "https://freelanceai.aicreator.academy").replace(/\/$/, "");
let pass = 0, fail = 0;
const results = [];

async function get(path) {
  const res = await fetch(B + path, { redirect: "manual" });
  const body = res.status < 400 ? await res.text().catch(() => "") : "";
  return { status: res.status, body };
}
function check(name, cond, detail = "") {
  results.push(`  ${cond ? "✅" : "❌"} ${name}${detail ? "  " + detail : ""}`);
  cond ? pass++ : fail++;
}
const countCovers = (b) => (b.match(/r2\.dev\/covers/g) || []).length;

console.log(`\n=== E2E prod sweep: ${B} ===`);

// 1. Locales render
console.log("\n[i18n] home renders in 3 locales");
for (const loc of ["uz", "ru", "en"]) {
  const { status, body } = await get(`/${loc}`);
  check(`home ${loc}`, status === 200 && body.includes("FreelanceAI") && countCovers(body) > 0, `(${status}, ${countCovers(body)} featured)`);
}

// 2. Marketplace + search
console.log("\n[discovery] marketplace + search + filters");
let r = await get("/uz/gigs");
check("marketplace renders", r.status === 200 && countCovers(r.body) >= 10, `(${countCovers(r.body)} cards)`);
r = await get("/uz/gigs?q=video");
check("search exact (video)", r.status === 200 && countCovers(r.body) > 0, `(${countCovers(r.body)})`);
r = await get("/uz/gigs?q=vidio");
check("search FUZZY typo (vidio)", r.status === 200 && countCovers(r.body) > 0, `(${countCovers(r.body)})`);
r = await get("/uz/gigs?q=reklma");
check("search FUZZY typo (reklma)", r.status === 200 && countCovers(r.body) > 0, `(${countCovers(r.body)})`);
r = await get("/uz/gigs?category=ai-video");
check("category filter narrows", r.status === 200 && countCovers(r.body) > 0 && countCovers(r.body) < 16, `(${countCovers(r.body)})`);
r = await get("/uz/gigs?min=400000&sort=price_asc");
check("price + sort filters", r.status === 200, `(${r.status})`);
r = await get("/uz/gigs?sort=popular");
check("sort by popular", r.status === 200 && countCovers(r.body) > 0, `(${countCovers(r.body)})`);
r = await get("/uz/categories/ai-video");
check("category landing page", r.status === 200 && countCovers(r.body) > 0, `(${r.status}, ${countCovers(r.body)})`);
r = await get("/uz/gigs?q=zzzznotarealthing");
check("no-match search empty", r.status === 200 && countCovers(r.body) === 0, `(${countCovers(r.body)})`);

// 3. Gig detail (pull a real slug)
console.log("\n[gig detail] full render");
const slug = (await get("/uz/gigs")).body.match(/\/uz\/gigs\/([a-z0-9-]+)/)?.[1];
if (slug) {
  const { status, body } = await get(`/uz/gigs/${slug}`);
  check("gig detail 200", status === 200, `(${slug})`);
  check("has order button", body.includes("Buyurtma berish"));
  check("has contact button", body.includes("Bog"));
  check("has save (♡/♥)", body.includes("♡") || body.includes("♥"));
  check("links to creator profile", /\/creators\/[a-z_]+/.test(body));
}
check("missing gig -> 404", (await get("/uz/gigs/__nope__")).status === 404);

// 4. Creator profile
console.log("\n[profile] creator storefront");
r = await get("/uz/creators/studio_aurora");
check("creator profile 200", r.status === 200 && r.body.includes("Studio Aurora"), `(${r.status})`);
check("profile shows gigs", countCovers(r.body) > 0, `(${countCovers(r.body)})`);
check("missing creator -> 404", (await get("/uz/creators/__nope__")).status === 404);

// 5. Guards (logged-out → login)
console.log("\n[guards] protected routes redirect");
for (const p of ["/uz/dashboard", "/uz/dashboard/seller", "/uz/orders/x", "/uz/messages", "/uz/admin/settlements", "/uz/admin/moderation", "/uz/admin/disputes", "/uz/dashboard/settings"]) {
  check(`guard ${p}`, (await get(p)).status === 307);
}

// 6. API auth matrix (mutations rejected)
console.log("\n[api] mutations reject anonymous");
async function mut(method, path) {
  const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", Origin: B }, body: "{}", redirect: "manual" });
  return res.status;
}
for (const [m, p] of [["POST", "/api/gigs"], ["POST", "/api/gigs/x"], ["POST", "/api/orders"], ["POST", "/api/orders/x"], ["POST", "/api/contact"], ["POST", "/api/saved"], ["POST", "/api/reviews"], ["POST", "/api/reviews/x"], ["POST", "/api/admin/payouts"], ["POST", "/api/admin/disputes/x"], ["PATCH", "/api/me/profile"], ["PATCH", "/api/me/settings"], ["POST", "/api/media/presign"]]) {
  check(`${m} ${p} -> 401`, (await mut(m, p)) === 401);
}
check("GET /api/orders/x/file -> 401", (await get("/api/orders/x/file?u=z")).status === 401);
check("POST /api/cron/auto-complete (no secret) -> 401", (await mut("POST", "/api/cron/auto-complete")) === 401);

// 7. SEO + health
console.log("\n[seo + ops]");
r = await get("/sitemap.xml");
check("sitemap.xml", r.status === 200 && r.body.includes("/uz/gigs/"));
r = await get("/robots.txt");
check("robots.txt", r.status === 200 && r.body.includes("Sitemap"));
if (slug) check("gig has <title>", (await get(`/uz/gigs/${slug}`)).body.toLowerCase().includes("<title>"));
r = await get("/api/health");
const h = JSON.parse(r.body || "{}").data ?? {};
check("health all green", h.db === "up" && h.trgm === true && h.media === true && h.email === true, JSON.stringify(h));
check("private media bucket active", h.privateMedia === true, `privateMedia=${h.privateMedia}`);
check("home has main landmark (a11y skip target)", (await get("/uz")).body.includes('id="main"'));

console.log("\n" + results.join("\n"));
console.log(`\n${fail === 0 ? "✅ ALL PASS" : `❌ ${fail} FAILED`}  (${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);

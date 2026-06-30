// Post-deploy regression smoke test. Checks every shipped feature's surface so a new
// deploy can't silently break an old one. Run AFTER every deploy:
//   node deploy/smoke-test.mjs                (defaults to prod)
//   node deploy/smoke-test.mjs https://host   (override base URL)
// Exit code 0 = all pass, 1 = something regressed.

const BASE = (process.argv[2] ?? "https://freelanceai.aicreator.academy").replace(/\/$/, "");

/**
 * expect: status code or array of acceptable codes.
 * origin: send same-origin header (needed to reach the auth layer on plain POST routes).
 * contains: substring that must appear in the body (proves the page actually rendered).
 */
const CHECKS = [
  // --- Health / infra ---
  { group: "Infra", name: "health db:up", method: "GET", path: "/api/health", expect: 200, contains: '"db":"up"' },
  { group: "SEO", name: "sitemap.xml", method: "GET", path: "/sitemap.xml", expect: 200, contains: "/uz/gigs" },
  { group: "SEO", name: "robots.txt", method: "GET", path: "/robots.txt", expect: 200, contains: "Sitemap" },

  // --- Public pages render in all 3 locales (catches i18n / message-catalog breakage) ---
  { group: "i18n", name: "home uz", method: "GET", path: "/uz", expect: 200, contains: "FreelanceAI" },
  { group: "i18n", name: "home ru", method: "GET", path: "/ru", expect: 200, contains: "FreelanceAI" },
  { group: "i18n", name: "home en", method: "GET", path: "/en", expect: 200, contains: "FreelanceAI" },

  // --- Marketplace + discovery (Phase 2/3) ---
  { group: "Gigs", name: "marketplace uz", method: "GET", path: "/uz/gigs", expect: 200, contains: "Xizmat qidirish" },
  { group: "Gigs", name: "marketplace ru", method: "GET", path: "/ru/gigs", expect: 200 },
  { group: "Gigs", name: "marketplace en", method: "GET", path: "/en/gigs", expect: 200 },
  { group: "Search", name: "filters q+cat+price+sort", method: "GET",
    path: "/uz/gigs?q=video&category=ai-video&min=1000&max=99999999&sort=price_asc", expect: 200 },
  { group: "Gigs", name: "missing gig -> 404", method: "GET", path: "/uz/gigs/__nope__", expect: 404 },
  { group: "Profiles", name: "creator profile", method: "GET", path: "/uz/creators/studio_aurora", expect: 200, contains: "Studio Aurora" },
  { group: "Profiles", name: "missing creator -> 404", method: "GET", path: "/uz/creators/__nope__", expect: 404 },

  // --- Auth entry points ---
  { group: "Auth", name: "login page", method: "GET", path: "/uz/login", expect: 200 },
  { group: "Auth", name: "become-creator page", method: "GET", path: "/uz/sell", expect: 200 },

  // --- Auth-gated pages redirect to login (307) ---
  { group: "Guards", name: "buyer dashboard gated", method: "GET", path: "/uz/dashboard", expect: 307 },
  { group: "Guards", name: "seller dashboard gated", method: "GET", path: "/uz/dashboard/seller", expect: 307 },
  { group: "Guards", name: "new gig gated", method: "GET", path: "/uz/dashboard/seller/gigs/new", expect: 307 },
  { group: "Guards", name: "order page gated", method: "GET", path: "/uz/orders/abc", expect: 307 },
  { group: "Guards", name: "admin settlements gated", method: "GET", path: "/uz/admin/settlements", expect: 307 },
  { group: "Guards", name: "admin moderation gated", method: "GET", path: "/uz/admin/moderation", expect: 307 },
  { group: "Guards", name: "messages inbox gated", method: "GET", path: "/uz/messages", expect: 307 },
  { group: "Guards", name: "edit profile gated", method: "GET", path: "/uz/dashboard/seller/profile", expect: 307 },
  { group: "Guards", name: "settings gated", method: "GET", path: "/uz/dashboard/settings", expect: 307 },

  // --- API endpoints reject unauthenticated (401) ---
  { group: "API", name: "create gig", method: "POST", path: "/api/gigs", origin: true, expect: 401 },
  { group: "API", name: "manage gig", method: "POST", path: "/api/gigs/abc", origin: true, expect: 401 },
  { group: "API", name: "media presign", method: "POST", path: "/api/media/presign", origin: true, expect: 401 },
  { group: "API", name: "create order", method: "POST", path: "/api/orders", origin: true, expect: 401 },
  { group: "API", name: "order action", method: "POST", path: "/api/orders/abc", origin: true, expect: 401 },
  { group: "API", name: "delivery file proxy", method: "GET", path: "/api/orders/abc/file?u=x", expect: 401 },
  { group: "API", name: "create review", method: "POST", path: "/api/reviews", origin: true, expect: 401 },
  { group: "API", name: "save gig", method: "POST", path: "/api/saved", origin: true, expect: 401 },
  { group: "API", name: "admin payout", method: "POST", path: "/api/admin/payouts", origin: true, expect: 401 },
  { group: "API", name: "contact seller", method: "POST", path: "/api/contact", origin: true, expect: 401 },
  { group: "API", name: "update profile", method: "PATCH", path: "/api/me/profile", origin: true, expect: 401 },
  { group: "API", name: "update settings", method: "PATCH", path: "/api/me/settings", origin: true, expect: 401 },
  { group: "API", name: "conversation messages", method: "GET", path: "/api/conversations/abc/messages", expect: 401 },
];

const ok = (expect, status) => (Array.isArray(expect) ? expect.includes(status) : expect === status);

async function run(c) {
  const headers = {};
  const isMutation = c.method !== "GET";
  if (isMutation) {
    headers["Content-Type"] = "application/json";
    if (c.origin) headers["Origin"] = BASE;
  }
  try {
    const res = await fetch(BASE + c.path, {
      method: c.method,
      headers,
      body: isMutation ? "{}" : undefined,
      redirect: "manual",
    });
    let pass = ok(c.expect, res.status);
    let note = "";
    if (pass && c.contains) {
      const body = await res.text();
      if (!body.includes(c.contains)) {
        pass = false;
        note = `missing "${c.contains}"`;
      }
    }
    return { ...c, status: res.status, pass, note };
  } catch (e) {
    return { ...c, status: "ERR", pass: false, note: String(e?.message).slice(0, 60) };
  }
}

const results = await Promise.all(CHECKS.map(run));

let group = "";
for (const r of results) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n${group}`);
  }
  const mark = r.pass ? "✅" : "❌";
  const want = Array.isArray(r.expect) ? r.expect.join("/") : r.expect;
  console.log(`  ${mark} ${r.name.padEnd(26)} ${r.method} ${r.path}  -> ${r.status} (want ${want}) ${r.note}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length === 0 ? "✅ ALL PASS" : `❌ ${failed.length} FAILED`}  (${results.length} checks, ${BASE})`);
process.exit(failed.length === 0 ? 0 : 1);

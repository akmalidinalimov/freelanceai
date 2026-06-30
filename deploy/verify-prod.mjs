// Post-deploy verification: waits for prod to come up, then runs the full check suite
// (HTTP smoke regression + deep content/search/SEO sweep + R2 storage). Single exit code.
// Run after a deploy:  node deploy/verify-prod.mjs   (or it's invoked by deploy-vps.ps1)
import { execSync } from "child_process";

const BASE = (process.env.E2E_BASE_URL ?? "https://freelanceai.aicreator.academy").replace(/\/$/, "");
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// The VPS rebuild tears down the old container before the new one serves, so the site
// 502s mid-deploy. Give the swap time to BEGIN, then require several consecutive healthy
// responses so we verify the NEW container once it's stably up (not the old one pre-swap).
const GRACE_MS = 45000;
process.stdout.write(`Grace ${GRACE_MS / 1000}s for container swap`);
await sleep(GRACE_MS);

process.stdout.write(`\nWaiting for ${BASE} to be stably healthy`);
let streak = 0;
const NEED = 3; // consecutive healthy checks
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${BASE}/api/health`, { redirect: "manual" });
    const body = r.status === 200 ? await r.json().catch(() => ({})) : {};
    if (r.status === 200 && body?.data?.db === "up") streak++;
    else streak = 0;
  } catch {
    streak = 0;
  }
  process.stdout.write(streak >= NEED ? "✓" : streak > 0 ? "+" : ".");
  if (streak >= NEED) break;
  await sleep(10000);
}
console.log(streak >= NEED ? " up ✅" : " TIMEOUT ❌");
if (streak < NEED) {
  console.log("\n❌ POST-DEPLOY VERIFY FAILED — prod did not become stably healthy in time");
  process.exit(1);
}

const steps = [
  ["smoke — HTTP regression over all features", "node deploy/smoke-test.mjs"],
  ["deep sweep — content + search + filters + SEO", "node deploy/e2e-prod.mjs"],
  ["R2 storage — upload + public serve", "node deploy/test-r2.mjs"],
];

let failed = 0;
for (const [name, cmd] of steps) {
  console.log(`\n========== ${name} ==========`);
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch {
    failed++;
    console.log(`❌ ${name} — FAILED`);
  }
}

console.log(
  `\n${failed === 0 ? "✅ POST-DEPLOY VERIFY PASSED (all suites green)" : `❌ POST-DEPLOY VERIFY: ${failed} suite(s) FAILED`}  — ${BASE}`
);
process.exit(failed === 0 ? 0 : 1);

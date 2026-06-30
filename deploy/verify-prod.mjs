// Post-deploy verification: waits for prod to come up, then runs the full check suite
// (HTTP smoke regression + deep content/search/SEO sweep + R2 storage). Single exit code.
// Run after a deploy:  node deploy/verify-prod.mjs   (or it's invoked by deploy-vps.ps1)
import { execSync } from "child_process";

const BASE = (process.env.E2E_BASE_URL ?? "https://freelanceai.aicreator.academy").replace(/\/$/, "");

process.stdout.write(`Waiting for ${BASE} to come up`);
let up = false;
for (let i = 0; i < 45; i++) {
  try {
    const r = await fetch(`${BASE}/uz/gigs`, { redirect: "manual" });
    if (r.status === 200) {
      up = true;
      break;
    }
  } catch {
    /* not up yet */
  }
  await new Promise((res) => setTimeout(res, 20000));
  process.stdout.write(".");
}
console.log(up ? " up ✅" : " TIMEOUT ❌");
if (!up) {
  console.log("\n❌ POST-DEPLOY VERIFY FAILED — prod did not return 200 in time");
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

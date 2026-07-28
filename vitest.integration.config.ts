import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

/**
 * Integration tests: run ONLY *.integration.test.ts, against a real Postgres reachable at
 * DATABASE_URL. Used by the `integration` CI job (postgres service) and locally via
 * `npm run test:integration`. Runs serially (single fork) so concurrency tests share one DB
 * without cross-file interference.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
});

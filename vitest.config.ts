import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside an RSC bundler; stub it for unit tests.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url)
      ),
    },
  },
});

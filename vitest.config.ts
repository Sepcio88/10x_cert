import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` -> `./src/*` path alias for tests.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

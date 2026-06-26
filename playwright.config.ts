import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Auto-load env files so the auth.setup.ts project sees SUPABASE_URL /
// SUPABASE_KEY the same way the dev server does. This is a Cloudflare-adapter
// app, so `astro dev` reads runtime secrets from `.dev.vars` (not Vite's
// .env*) — that's the canonical source here. We still honor .env.local / .env
// if present. Earlier entries win (loadEnvFile does not overwrite keys already
// set), so list the highest-priority file first.
// Node ≥20.12 API; engines pins ≥22.12.
for (const f of [".env.local", ".env", ".dev.vars"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

const isCI = !!process.env.CI;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";
const STORAGE_STATE = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["html"], ["github"]] : [["html"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // setup provisions the user; its `teardown` runs the cleanup project once
    // all dependents finish, deleting that user from Supabase.
    { name: "setup", testMatch: /.*\.setup\.ts/, teardown: "cleanup" },
    { name: "cleanup", testMatch: /.*\.teardown\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});

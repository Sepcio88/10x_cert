/**
 * E2E auth setup project.
 *
 * Provisions a unique, already-confirmed test user on every run, captures an
 * authenticated browser session into playwright/.auth/user.json (the
 * storageState the chromium project consumes by default), and persists the
 * credentials + user id to playwright/.auth/credentials.json (gitignored) so
 * the teardown can delete the user afterwards.
 *
 * Why admin.createUser instead of anon signUp: the hosted Supabase project has
 * email confirmation enabled, so a plain signUp leaves the user unconfirmed
 * (signInWithPassword would fail with "Email not confirmed") and also burns the
 * signup email rate limit. The admin API creates the user with
 * email_confirm: true — no email sent, no rate limit, immediately signable-in.
 * This needs the service_role key, a server-only secret that must never reach
 * the browser; it is used here only in the Node setup process.
 *
 * Unique-per-run policy: the email carries a timestamp + random suffix so runs
 * never collide on auth.users. The matching auth.teardown.ts deletes the user
 * (cascade removes their practice_sessions) once the suite finishes.
 */
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const STORAGE_STATE = "playwright/.auth/user.json";
const CREDS_FILE = "playwright/.auth/credentials.json";

setup("create test user and capture storageState", async ({ page }) => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the E2E setup project. " +
        "Locally: add them to .dev.vars (Playwright auto-loads it via playwright.config.ts). " +
        "In CI: they are injected from GitHub secrets.",
    );
  }

  const stamp = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  const email = `e2e+${stamp}@example.com`;
  const password = `e2e-${randomBytes(8).toString("hex")}`;

  // Create a pre-confirmed user via the admin API (no email, no rate limit).
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(`admin.createUser failed: ${createError.message}`);
  const userId = created.user?.id;
  if (!userId) throw new Error("admin.createUser returned no user id");

  // Persist credentials + id so the teardown can delete the user later.
  // The file is gitignored via .gitignore's `playwright/.auth/*.json` rule.
  const credsPath = resolve(CREDS_FILE);
  mkdirSync(dirname(credsPath), { recursive: true });
  writeFileSync(credsPath, JSON.stringify({ email, password, userId }, null, 2), "utf-8");

  // Log in once via the real UI to capture an authenticated browser session.
  // This is the single login-via-UI moment in the entire suite — every other
  // test reuses storageState per the M3L4 rule "Use storageState for
  // authentication — never log in through UI in individual tests."
  // waitUntil: "networkidle" lets the React chunk load and hydrate before .fill()
  // attempts. Without it the first .fill() races React's onChange listener
  // attachment — the DOM is filled but React's controlled-state reverts it to "".
  await page.goto("/auth/signin", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  // exact: true disambiguates from the "Show password" toggle button (PasswordToggle.tsx).
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");

  // Sanity check: the session cookie that middleware accepts is in place
  // before we save state, otherwise storageState reuse later would silently
  // produce a logged-out context. /dashboard is middleware-gated, so reaching
  // its real heading ("Your progress") proves the session is authenticated.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Your progress" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});

/**
 * E2E auth teardown project — runs after the suite (wired via the setup
 * project's `teardown` in playwright.config.ts).
 *
 * Deletes the per-run test user created in auth.setup.ts. The
 * practice_sessions FK is ON DELETE CASCADE, so removing the user also removes
 * any sessions the run created — leaving the hosted project clean (e2e.md:
 * "Clean up in afterEach"; here a single owner deletion covers the whole run).
 *
 * Best-effort: if the credentials file or secrets are absent, there is nothing
 * to clean up, so we return quietly rather than fail the run.
 */
import { test as teardown } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CREDS_FILE = "playwright/.auth/credentials.json";

teardown("delete test user", async () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  let userId: string | undefined;
  try {
    const parsed = JSON.parse(readFileSync(resolve(CREDS_FILE), "utf-8")) as { userId?: string };
    userId = parsed.userId;
  } catch {
    return; // no creds file → nothing provisioned to clean up
  }
  if (!userId) return;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`admin.deleteUser failed: ${error.message}`);
});

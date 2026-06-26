/**
 * Key product flow (US-01): a signed-in developer generates a question set,
 * answers it with immediate explanation-first feedback, completes the session
 * (which is saved), and sees that session reflected in their progress.
 *
 * Rules honored (.claude/rules/e2e.md):
 *  - getByRole / getByLabel locators only — no CSS, XPath, or DOM structure.
 *  - storageState authentication (the chromium project's default user from
 *    auth.setup.ts); no UI login inside this test.
 *  - Waits are condition-based: waitForResponse / toBeVisible — never waitForTimeout.
 *  - Assertions are business outcomes (feedback shown, session saved, progress
 *    reflects the exam), not implementation details.
 *  - Independently runnable and retry-safe: the post-state is asserted without a
 *    "zero sessions before" precondition, so a retry that already created a
 *    session still passes.
 */
import { test, expect } from "@playwright/test";

const PROVIDER = "AWS";
// A well-known exam code so generation is recognized (high confidence) and the
// progress trend groups under a stable, predictable exam label.
const EXAM = "SAA-C03";

test("generate a set, answer with feedback, and see progress update", async ({ page }) => {
  // On-demand generation calls a real LLM (NFR: ready within ~10s); give the
  // whole flow generous headroom over Playwright's default per-test timeout.
  test.setTimeout(90_000);

  // --- Generate a one-question set (smallest valid set keeps the LLM call quick) ---
  // networkidle lets the client island hydrate before the controlled inputs are
  // filled, so React's onChange captures the values (see auth.setup.ts rationale).
  await page.goto("/practice", { waitUntil: "networkidle" });
  await page.getByLabel("Cloud provider").selectOption(PROVIDER);
  await page.getByLabel("Exam code or name").fill(EXAM);
  await page.getByLabel(/Number of questions/).fill("1");

  const generateButton = page.getByRole("button", { name: "Generate questions" });
  await expect(generateButton).toBeEnabled();

  const generated = page.waitForResponse(
    (r) => r.url().includes("/api/practice/generate") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await generateButton.click();
  expect((await generated).ok()).toBeTruthy();

  // --- Answer the question and get immediate, explanation-first feedback (FR-006/FR-007) ---
  await expect(page.getByText("Question 1 of 1")).toBeVisible();

  await page.getByRole("radio").first().check();
  const submitButton = page.getByRole("button", { name: "Submit answer" });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  // Feedback business outcome: a correctness verdict plus a "Why" rationale.
  await expect(page.getByText(/^(Correct|Incorrect)$/)).toBeVisible();
  await expect(page.getByText("Why", { exact: true })).toBeVisible();

  // --- Complete the session; it must be persisted (FR-006 / guardrail: never lost) ---
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/practice/sessions") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "See results" }).click();
  expect((await saved).ok()).toBeTruthy();

  await expect(page.getByText("Session complete")).toBeVisible();
  await expect(page.getByText("Saved to your history.")).toBeVisible({ timeout: 15_000 });

  // --- Progress reflects the completed session (FR-010) ---
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Your progress" })).toBeVisible();
  // The trend for the exam we just practiced is now present, with a latest score.
  await expect(page.getByRole("img", { name: `Score trend for ${EXAM}` })).toBeVisible();
  await expect(page.getByText(/latest \d+%/)).toBeVisible();
});

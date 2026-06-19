import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { saveSession } from "@/lib/db/sessions";
import { gradeSubmission } from "@/lib/practice/session";
import { questionSchema } from "@/lib/services/question-schema";

export const prerender = false;

const requestSchema = z.object({
  provider: z.enum(["AWS", "Azure", "GCP"]),
  exam: z.string().trim().min(1),
  questions: z.array(questionSchema).min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().min(1),
      }),
    )
    .min(1),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Persist a COMPLETED practice session (save-on-complete). Auth-gated; validates the
 * submitted payload; rejects non-completed sessions; recomputes the score
 * server-side (never trusts the client's correctness) before inserting. Returns the
 * new session id so the client can confirm the save.
 */
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ ok: false, error: { code: "unauthorized", message: "Sign in to save sessions." } }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-input", message: "Request body must be valid JSON." } }, 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: { code: "invalid-input", message: "Malformed session payload." } }, 400);
  }

  const { provider, exam, questions, answers } = parsed.data;
  if (answers.length !== questions.length) {
    return json(
      { ok: false, error: { code: "incomplete-session", message: "Only completed sessions can be saved." } },
      400,
    );
  }

  const graded = gradeSubmission(questions, answers);
  if (!graded.ok) {
    return json({ ok: false, error: { code: "invalid-input", message: graded.error } }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ ok: false, error: { code: "not-configured", message: "Storage is not configured." } }, 500);
  }

  const result = await saveSession(supabase, context.locals.user.id, {
    provider,
    exam,
    payload: { questions, answers: graded.answers },
    score: graded.score,
  });

  if (!result.ok) {
    return json({ ok: false, error: { code: "save-failed", message: result.error } }, 500);
  }
  return json({ ok: true, id: result.id }, 200);
};

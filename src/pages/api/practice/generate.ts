import type { APIRoute } from "astro";
import { z } from "zod";
import { generateQuestions } from "@/lib/services/question-generator";
import { MIN_QUESTION_COUNT, MAX_QUESTION_COUNT } from "@/lib/services/question-schema";

export const prerender = false;

const requestSchema = z.object({
  provider: z.enum(["AWS", "Azure", "GCP"]),
  exam: z.string().trim().min(1),
  count: z.number().int().min(MIN_QUESTION_COUNT).max(MAX_QUESTION_COUNT),
  /** Optional weak-topic targeting (S-05): focus generation on these domains. */
  topics: z.array(z.string().min(1)).optional(),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Auth-gated, validated entry point that exposes the server-only generation engine
 * to the browser. Composes the engine's `exam` identifier from provider + exam and
 * passes its typed `GenerationResult` straight through. Never throws.
 */
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ ok: false, error: { code: "unauthorized", message: "Sign in to generate questions." } }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-input", message: "Request body must be valid JSON." } }, 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        error: {
          code: "invalid-input",
          message: `Choose a provider, an exam, and between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT} questions.`,
        },
      },
      400,
    );
  }

  const { provider, exam, count, topics } = parsed.data;
  const result = await generateQuestions({ exam: `${provider} ${exam}`, count, topics });

  return json(result, result.ok ? 200 : 400);
};

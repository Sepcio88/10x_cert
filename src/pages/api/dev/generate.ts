import type { APIRoute } from "astro";
import { generateQuestions } from "@/lib/services/question-generator";

export const prerender = false;

/**
 * Dev-only verification endpoint for the question-generation engine. NOT part of the
 * user-facing product — it exists so a human can exercise the real engine and inspect
 * the full structured output (including correct answers + explanations) for the manual
 * accuracy spot-check. Gated out of production builds via `import.meta.env.PROD`.
 *
 * Usage (dev): GET /api/dev/generate?exam=AWS%20SAA-C03&count=10
 */
export const GET: APIRoute = async (context) => {
  if (import.meta.env.PROD) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(context.request.url);
  const exam = url.searchParams.get("exam") ?? "";
  const count = Number(url.searchParams.get("count") ?? "10");

  const started = Date.now();
  const result = await generateQuestions({ exam, count });
  const elapsedMs = Date.now() - started;

  return new Response(JSON.stringify({ elapsedMs, ...result }, null, 2), {
    status: result.ok ? 200 : 400,
    headers: { "Content-Type": "application/json" },
  });
};

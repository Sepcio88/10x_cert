import { createOpenRouterClient, type ChatMessage } from "@/lib/services/openrouter";
import { MIN_QUESTION_COUNT, MAX_QUESTION_COUNT, generationResponseSchema } from "@/lib/services/question-schema";
import type { GenerateQuestionsInput, GenerationResult } from "@/types";

/** Fast, capable default; OpenRouter lets this be swapped without code changes. */
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const TEMPERATURE = 0.2;
/** One initial attempt + one retry on parse/validation failure. */
const MAX_ATTEMPTS = 2;

function buildMessages(exam: string, count: number): ChatMessage[] {
  const system = [
    "You are an expert author of practice questions for cloud certification exams.",
    "Generate multiple-choice questions representative of the named exam, grounded in that exam's official knowledge domains.",
    "Each question must have exactly 4 options with ids 'a','b','c','d' and exactly one correct option.",
    "Write the explanation reasoning-first: explain the underlying concept and why the correct option is right (and why the others are wrong) — do not merely name the letter.",
    "Tag each question with its exam topic/domain.",
    'If you do not recognize the exam or are unsure of its domains, set "confidence" to "low"; otherwise "high".',
    "Respond with ONLY valid JSON — no markdown fences, no commentary.",
  ].join(" ");

  const user = [
    `Exam: ${exam}`,
    `Number of questions: ${count}`,
    "Return JSON of exactly this shape:",
    '{"questions":[{"id":"q1","stem":"...","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],"correctOptionId":"a","explanation":"...","topic":"..."}],"confidence":"high"}',
    `Generate exactly ${count} question(s).`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Strip an optional ```json … ``` fence the model may wrap the JSON in. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Generate exam-representative questions. Returns a discriminated result and never
 * throws: count is validated before any call; a missing API key yields `not-configured`;
 * malformed/invalid model output is retried once then yields `invalid-output`; provider
 * or network failures yield `provider-error`.
 */
export async function generateQuestions(input: GenerateQuestionsInput): Promise<GenerationResult> {
  const { exam, count } = input;

  if (!Number.isInteger(count) || count < MIN_QUESTION_COUNT || count > MAX_QUESTION_COUNT) {
    return {
      ok: false,
      error: {
        code: "invalid-count",
        message: `count must be an integer between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}`,
      },
    };
  }

  const client = createOpenRouterClient();
  if (!client) {
    return {
      ok: false,
      error: { code: "not-configured", message: "OPENROUTER_API_KEY is not configured" },
    };
  }

  const messages = buildMessages(exam, count);
  let lastIssue = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await client.chat({ model: DEFAULT_MODEL, messages, temperature: TEMPERATURE });
    } catch (err) {
      return {
        ok: false,
        error: { code: "provider-error", message: err instanceof Error ? err.message : "provider request failed" },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      lastIssue = "response was not valid JSON";
      continue;
    }

    const result = generationResponseSchema.safeParse(parsed);
    if (!result.success) {
      lastIssue = "response did not match the question schema";
      continue;
    }
    if (result.data.questions.length !== count) {
      lastIssue = `expected ${count} questions, received ${result.data.questions.length}`;
      continue;
    }

    return { ok: true, questions: result.data.questions, confidence: result.data.confidence };
  }

  return {
    ok: false,
    error: {
      code: "invalid-output",
      message: `generation produced invalid output after ${MAX_ATTEMPTS} attempts: ${lastIssue}`,
    },
  };
}

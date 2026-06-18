import { z } from "zod";

/**
 * Hard bounds on questions per generation request (protects the <10s latency budget).
 * Cap lowered from 20 to 5 for the MVP: a single synchronous gpt-4o-mini call for
 * ~10 questions exceeds the 9s timeout, so 5 keeps generation comfortably under budget.
 * Raising it again needs a faster model or streaming (see F-01 follow-up).
 */
export const MIN_QUESTION_COUNT = 1;
export const MAX_QUESTION_COUNT = 5;

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const questionSchema = z
  .object({
    id: z.string().min(1),
    stem: z.string().min(1),
    options: z.array(questionOptionSchema).length(4),
    correctOptionId: z.string().min(1),
    explanation: z.string().min(1),
    topic: z.string().min(1),
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    message: "correctOptionId must match one of the option ids",
    path: ["correctOptionId"],
  });

export const confidenceSchema = z.enum(["high", "low"]);

/** The full structured response the model must return for a generation request. */
export const generationResponseSchema = z.object({
  questions: z.array(questionSchema),
  confidence: confidenceSchema,
});

import type { z } from "zod";
import type { questionOptionSchema, questionSchema, confidenceSchema } from "@/lib/services/question-schema";

// === Question-generation contract (consumed by S-01, S-02, S-04) ===

export type QuestionOption = z.infer<typeof questionOptionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type GenerationConfidence = z.infer<typeof confidenceSchema>;

export interface GenerateQuestionsInput {
  /** Exam code or name, e.g. "AWS SAA-C03". */
  exam: string;
  /** Number of questions to generate (1..MAX_QUESTION_COUNT). */
  count: number;
}

export type GenerationErrorCode = "invalid-count" | "not-configured" | "invalid-output" | "provider-error";

export interface GenerationError {
  code: GenerationErrorCode;
  message: string;
}

/** Discriminated result — the generator never throws to its caller. */
export type GenerationResult =
  | { ok: true; questions: Question[]; confidence: GenerationConfidence }
  | { ok: false; error: GenerationError };

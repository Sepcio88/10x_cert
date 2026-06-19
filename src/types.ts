import type { z } from "zod";
import type { questionOptionSchema, questionSchema, confidenceSchema } from "@/lib/services/question-schema";

// === Question-generation contract (consumed by S-01, S-02) ===

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

// === Answering-session contract (S-02) ===

/** One graded answer: the option the user picked and whether it matched the correct one. */
export interface AnswerRecord {
  /** Id of the question this answer belongs to (mirrors `Question.id`). */
  questionId: string;
  /** The option the user selected. */
  selectedOptionId: string;
  /** True iff `selectedOptionId === question.correctOptionId`. */
  correct: boolean;
}

/**
 * An in-progress (or completed) answering session. Plain, serializable data —
 * all transitions live in `src/lib/practice/session.ts` as pure functions.
 * `answers` is index-aligned with `questions` and grows forward-only:
 * `answers[i]` is the graded answer for `questions[i]`, present iff that question
 * has been submitted. The session is complete once `currentIndex` advances past
 * the last question.
 */
export interface PracticeSession {
  questions: Question[];
  /** Index of the current question; equals `questions.length` when complete. */
  currentIndex: number;
  /** Forward-only list of graded answers, aligned with `questions` by position. */
  answers: AnswerRecord[];
}

/** Overall session score; `percentage` is rounded to the nearest integer. */
export interface SessionScore {
  correct: number;
  total: number;
  percentage: number;
}

/** Per-topic/domain tally within a session (S-04, FR-008). `percentage` rounds to nearest int. */
export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
  percentage: number;
}

// === Persistence contract (S-03) ===

/** A raw, ungraded answer as submitted by the client; graded server-side on save. */
export interface RawAnswer {
  questionId: string;
  selectedOptionId: string;
}

/** The full, revisitable session content stored as JSONB. `answers` stays index-aligned with `questions`. */
export interface SessionPayload {
  questions: Question[];
  answers: AnswerRecord[];
}

/** A saved session as shown in the history list — queryable columns only, no payload. */
export interface SavedSessionSummary {
  id: string;
  provider: string;
  exam: string;
  correct: number;
  total: number;
  percentage: number;
  /** ISO timestamp (DB `created_at`). */
  createdAt: string;
}

/** A saved session with its full payload, for the revisit detail view. */
export interface SavedSession extends SavedSessionSummary {
  payload: SessionPayload;
}

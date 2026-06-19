import type { AnswerRecord, PracticeSession, Question, RawAnswer, SessionScore } from "@/types";

/**
 * Pure answering-session lifecycle for S-02. No React, no I/O — every function
 * takes a session and returns a new one (or a derived value), so the grading and
 * progression rules are unit-testable in isolation from the UI.
 *
 * Invariants:
 * - `answers` is index-aligned with `questions` and filled strictly forward:
 *   `answers.length === currentIndex` means the current question is unanswered;
 *   `answers.length === currentIndex + 1` means it has been submitted.
 * - A question is graded exactly once (submit is idempotent-guarded).
 * - Advancing requires the current question to be answered.
 */

/** Start a fresh session at the first question with no answers recorded. */
export function createSession(questions: Question[]): PracticeSession {
  return { questions, currentIndex: 0, answers: [] };
}

/** The question the user is currently on, or `null` once the session is complete. */
export function currentQuestion(session: PracticeSession): Question | null {
  return session.questions[session.currentIndex] ?? null;
}

/** The graded answer for question at `index`, or `undefined` if not yet answered. */
export function getAnswer(session: PracticeSession, index: number): AnswerRecord | undefined {
  return session.answers[index];
}

/** Whether the current question has been submitted (and is therefore locked). */
export function isCurrentAnswered(session: PracticeSession): boolean {
  return session.answers.length > session.currentIndex;
}

/** Number of questions answered so far. */
export function answeredCount(session: PracticeSession): number {
  return session.answers.length;
}

/** Running count of correct answers. */
export function correctCount(session: PracticeSession): number {
  return session.answers.reduce((n, a) => (a.correct ? n + 1 : n), 0);
}

/** True once every question has been answered and the user has advanced past the last. */
export function isComplete(session: PracticeSession): boolean {
  return session.currentIndex >= session.questions.length;
}

/** Overall score; percentage rounds to the nearest integer (0 when there are no questions). */
export function score(session: PracticeSession): SessionScore {
  const total = session.questions.length;
  const correct = correctCount(session);
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percentage };
}

/**
 * Grade and record the answer for the current question. Guarded: returns the
 * session unchanged if it is already complete or the current question has already
 * been answered (no re-grading).
 */
export function submitAnswer(session: PracticeSession, selectedOptionId: string): PracticeSession {
  const question = currentQuestion(session);
  if (question === null || isCurrentAnswered(session)) {
    return session;
  }
  const record: AnswerRecord = {
    questionId: question.id,
    selectedOptionId,
    correct: selectedOptionId === question.correctOptionId,
  };
  return { ...session, answers: [...session.answers, record] };
}

/**
 * Advance to the next question. Guarded: returns the session unchanged unless the
 * current question has been answered (forward-only, must answer to proceed).
 */
export function advance(session: PracticeSession): PracticeSession {
  if (!isCurrentAnswered(session)) {
    return session;
  }
  return { ...session, currentIndex: session.currentIndex + 1 };
}

/** Server-authoritative grading result for a submitted session (S-03). */
export type GradeResult = { ok: true; answers: AnswerRecord[]; score: SessionScore } | { ok: false; error: string };

/**
 * Recompute authoritative answers + score from a raw client submission, ignoring any
 * client-sent correctness. Each answer's `correct` is derived by matching its
 * `questionId` to the question's `correctOptionId` — the persisted score must never
 * trust a client-supplied flag (the product's trust anchor). Returns an error if an
 * answer references a question id absent from the set.
 */
export function gradeSubmission(questions: Question[], rawAnswers: RawAnswer[]): GradeResult {
  const questionIds = new Set(questions.map((question) => question.id));
  // Reject any answer that references a question not in the set.
  for (const raw of rawAnswers) {
    if (!questionIds.has(raw.questionId)) {
      return { ok: false, error: `Unknown questionId: ${raw.questionId}` };
    }
  }
  // Build answers by iterating `questions`, so the result is index-aligned with
  // `questions` by construction — SessionReview pairs them positionally on revisit.
  const rawById = new Map(rawAnswers.map((raw) => [raw.questionId, raw]));
  const answers: AnswerRecord[] = [];
  for (const question of questions) {
    const raw = rawById.get(question.id);
    if (raw === undefined) {
      return { ok: false, error: `Missing answer for questionId: ${question.id}` };
    }
    answers.push({
      questionId: question.id,
      selectedOptionId: raw.selectedOptionId,
      correct: raw.selectedOptionId === question.correctOptionId,
    });
  }
  const completed: PracticeSession = { questions, currentIndex: questions.length, answers };
  return { ok: true, answers, score: score(completed) };
}

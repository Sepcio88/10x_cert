import { describe, it, expect } from "vitest";
import type { Question } from "@/types";
import {
  advance,
  answeredCount,
  correctCount,
  createSession,
  currentQuestion,
  getAnswer,
  isComplete,
  isCurrentAnswered,
  score,
  submitAnswer,
} from "@/lib/practice/session";

/** Build a question whose correct option is `correctOptionId` (defaults to "a"). */
function q(id: string, correctOptionId = "a"): Question {
  return {
    id,
    stem: `Stem ${id}`,
    options: [
      { id: "a", text: "Option A" },
      { id: "b", text: "Option B" },
      { id: "c", text: "Option C" },
      { id: "d", text: "Option D" },
    ],
    correctOptionId,
    explanation: `Because ${correctOptionId} is right.`,
    topic: "Topic",
  };
}

/** Answer the current question correctly, then advance. */
function answerCorrectAndAdvance(session: ReturnType<typeof createSession>) {
  const current = currentQuestion(session);
  if (!current) return session;
  return advance(submitAnswer(session, current.correctOptionId));
}

describe("createSession", () => {
  it("starts at index 0 with no answers", () => {
    const s = createSession([q("1"), q("2")]);
    expect(s.currentIndex).toBe(0);
    expect(s.answers).toEqual([]);
    expect(currentQuestion(s)?.id).toBe("1");
    expect(answeredCount(s)).toBe(0);
    expect(isCurrentAnswered(s)).toBe(false);
  });
});

describe("submitAnswer grading", () => {
  it("marks a matching option correct", () => {
    const s = submitAnswer(createSession([q("1", "b")]), "b");
    expect(getAnswer(s, 0)).toEqual({ questionId: "1", selectedOptionId: "b", correct: true });
    expect(correctCount(s)).toBe(1);
    expect(isCurrentAnswered(s)).toBe(true);
  });

  it("marks a non-matching option incorrect but still records the pick", () => {
    const s = submitAnswer(createSession([q("1", "b")]), "c");
    expect(getAnswer(s, 0)).toEqual({ questionId: "1", selectedOptionId: "c", correct: false });
    expect(correctCount(s)).toBe(0);
  });

  it("does not mutate the input session", () => {
    const original = createSession([q("1")]);
    submitAnswer(original, "a");
    expect(original.answers).toEqual([]);
  });
});

describe("guards", () => {
  it("cannot re-grade an already-answered question", () => {
    const first = submitAnswer(createSession([q("1", "a")]), "a"); // correct
    const second = submitAnswer(first, "b"); // attempt to overwrite with a wrong pick
    expect(second).toBe(first); // unchanged reference
    expect(getAnswer(second, 0)?.selectedOptionId).toBe("a");
    expect(correctCount(second)).toBe(1);
  });

  it("cannot advance before answering the current question", () => {
    const s = createSession([q("1"), q("2")]);
    const advanced = advance(s);
    expect(advanced).toBe(s); // unchanged reference
    expect(advanced.currentIndex).toBe(0);
  });

  it("advances once the current question is answered", () => {
    const s = advance(submitAnswer(createSession([q("1"), q("2")]), "a"));
    expect(s.currentIndex).toBe(1);
    expect(currentQuestion(s)?.id).toBe("2");
    expect(isCurrentAnswered(s)).toBe(false); // the new current question is unanswered
  });
});

describe("isComplete", () => {
  it("is false until the last question is answered AND advanced", () => {
    let s = createSession([q("1"), q("2")]);
    expect(isComplete(s)).toBe(false);
    s = submitAnswer(s, "a"); // answered Q1, not advanced
    expect(isComplete(s)).toBe(false);
    s = advance(s); // on Q2
    expect(isComplete(s)).toBe(false);
    s = submitAnswer(s, "a"); // answered last question, not yet advanced
    expect(isComplete(s)).toBe(false);
    s = advance(s); // advanced past the last
    expect(isComplete(s)).toBe(true);
    expect(currentQuestion(s)).toBeNull();
  });
});

describe("score aggregation", () => {
  it("computes 0/N when every answer is wrong", () => {
    let s = createSession([q("1", "a"), q("2", "a"), q("3", "a")]);
    for (let i = 0; i < 3; i++) {
      s = advance(submitAnswer(s, "b")); // always pick the wrong option
    }
    expect(score(s)).toEqual({ correct: 0, total: 3, percentage: 0 });
  });

  it("computes N/N when every answer is correct", () => {
    let s = createSession([q("1"), q("2"), q("3")]);
    for (let i = 0; i < 3; i++) {
      s = answerCorrectAndAdvance(s);
    }
    expect(score(s)).toEqual({ correct: 3, total: 3, percentage: 100 });
  });

  it("rounds the percentage to the nearest integer", () => {
    // 2 of 3 correct → 66.67 → 67
    let s = createSession([q("1"), q("2"), q("3")]);
    s = answerCorrectAndAdvance(s);
    s = answerCorrectAndAdvance(s);
    s = advance(submitAnswer(s, "b")); // third wrong
    expect(score(s)).toEqual({ correct: 2, total: 3, percentage: 67 });
  });

  it("returns a zeroed score with 0% for an empty question set", () => {
    const s = createSession([]);
    expect(isComplete(s)).toBe(true);
    expect(score(s)).toEqual({ correct: 0, total: 0, percentage: 0 });
  });
});

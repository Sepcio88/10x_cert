import { describe, it, expect } from "vitest";
import { groupByExam, mostRecentExam, weakTopics, weakTopicsByExam } from "@/lib/practice/progress";
import type { SavedSession, SavedSessionSummary, SessionPayload } from "@/types";

function s(id: string, exam: string, percentage: number, createdAt: string, provider = "AWS"): SavedSessionSummary {
  return { id, provider, exam, correct: 0, total: 5, percentage, createdAt };
}

/** Build a payload from (topic, correct) specs; answers index-aligned with questions. */
function payload(specs: { topic: string; correct: boolean }[]): SessionPayload {
  const questions = specs.map((spec, i) => ({
    id: String(i + 1),
    stem: `Stem ${i + 1}`,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
      { id: "d", text: "D" },
    ],
    correctOptionId: "a",
    explanation: "Because.",
    topic: spec.topic,
  }));
  const answers = specs.map((spec, i) => ({
    questionId: String(i + 1),
    selectedOptionId: spec.correct ? "a" : "b",
    correct: spec.correct,
  }));
  return { questions, answers };
}

function saved(exam: string, p: SessionPayload): SavedSession {
  return {
    id: "x",
    provider: "AWS",
    exam,
    correct: 0,
    total: p.questions.length,
    percentage: 0,
    createdAt: "2026-06-21T00:00:00Z",
    payload: p,
  };
}

describe("groupByExam", () => {
  it("groups by exam without blending and orders points oldest → newest", () => {
    const groups = groupByExam([
      s("1", "SAA-C03", 80, "2026-06-19T12:00:00Z"),
      s("2", "AZ-204", 50, "2026-06-18T09:00:00Z", "Azure"),
      s("3", "SAA-C03", 60, "2026-06-17T08:00:00Z"), // earlier than #1
    ]);
    const saa = groups.find((g) => g.exam === "SAA-C03");
    const az = groups.find((g) => g.exam === "AZ-204");
    expect(saa?.points.map((p) => p.percentage)).toEqual([60, 80]); // oldest → newest
    expect(saa?.provider).toBe("AWS");
    expect(saa?.latestAt).toBe("2026-06-19T12:00:00Z");
    expect(az?.points.map((p) => p.percentage)).toEqual([50]);
    expect(az?.provider).toBe("Azure");
  });

  it("returns one point for a single-session exam", () => {
    const groups = groupByExam([s("1", "SAA-C03", 80, "2026-06-19T12:00:00Z")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.points).toHaveLength(1);
  });

  it("returns an empty array for no sessions", () => {
    expect(groupByExam([])).toEqual([]);
  });
});

describe("mostRecentExam", () => {
  it("picks the exam with the latest session", () => {
    const groups = groupByExam([
      s("1", "SAA-C03", 80, "2026-06-17T12:00:00Z"),
      s("2", "AZ-204", 50, "2026-06-19T09:00:00Z", "Azure"),
    ]);
    expect(mostRecentExam(groups)).toBe("AZ-204");
  });

  it("returns null when there are no groups", () => {
    expect(mostRecentExam([])).toBeNull();
  });
});

describe("weakTopics", () => {
  it("flags topics below 70% accumulated across sessions, weakest-first", () => {
    const weak = weakTopics([
      payload([
        { topic: "Networking", correct: false }, // Networking 0/2 = 0%
        { topic: "Compute", correct: true }, // Compute 2/2 = 100%
      ]),
      payload([
        { topic: "Networking", correct: false },
        { topic: "Compute", correct: true },
        { topic: "Security", correct: true }, // Security 2/3 = 67%
        { topic: "Security", correct: false },
        { topic: "Security", correct: true },
      ]),
    ]);
    // Networking 0% before Security 67% (weakest-first); Compute (100%) excluded.
    expect(weak).toEqual(["Networking", "Security"]);
  });

  it("treats a topic at exactly the threshold (70%) as not weak", () => {
    const specs = Array.from({ length: 10 }, (_, i) => ({ topic: "Compute", correct: i < 7 })); // 7/10 = 70%
    expect(weakTopics([payload(specs)])).toEqual([]);
  });

  it("flags 67% (just under threshold) as weak", () => {
    const weak = weakTopics([
      payload([
        { topic: "Compute", correct: true },
        { topic: "Compute", correct: true },
        { topic: "Compute", correct: false }, // 2/3 = 67%
      ]),
    ]);
    expect(weak).toEqual(["Compute"]);
  });

  it("returns an empty array for no payloads", () => {
    expect(weakTopics([])).toEqual([]);
  });
});

describe("weakTopicsByExam", () => {
  it("groups weak topics per exam and omits exams with none", () => {
    const map = weakTopicsByExam([
      saved("SAA-C03", payload([{ topic: "Networking", correct: false }])),
      saved("AZ-204", payload([{ topic: "Compute", correct: true }])), // all correct → no weak
    ]);
    expect(map["SAA-C03"]).toEqual(["Networking"]);
    expect(map["AZ-204"]).toBeUndefined();
  });

  it("returns an empty map for no sessions", () => {
    expect(weakTopicsByExam([])).toEqual({});
  });
});

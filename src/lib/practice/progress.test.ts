import { describe, it, expect } from "vitest";
import { groupByExam, mostRecentExam } from "@/lib/practice/progress";
import type { SavedSessionSummary } from "@/types";

function s(id: string, exam: string, percentage: number, createdAt: string, provider = "AWS"): SavedSessionSummary {
  return { id, provider, exam, correct: 0, total: 5, percentage, createdAt };
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

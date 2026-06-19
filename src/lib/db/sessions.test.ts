import { describe, it, expect } from "vitest";
import { rowToSummary, rowToSaved, type SessionRow, type SummaryRow } from "@/lib/db/sessions";
import type { SessionPayload } from "@/types";

const payload: SessionPayload = {
  questions: [
    {
      id: "1",
      stem: "Stem 1",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" },
        { id: "d", text: "D" },
      ],
      correctOptionId: "a",
      explanation: "Because a.",
      topic: "Compute",
    },
  ],
  answers: [{ questionId: "1", selectedOptionId: "a", correct: true }],
};

const summaryRow: SummaryRow = {
  id: "sess-1",
  provider: "AWS",
  exam: "AWS SAA-C03",
  correct: 1,
  total: 1,
  percentage: 100,
  created_at: "2026-06-19T10:00:00.000Z",
};

describe("rowToSummary", () => {
  it("projects snake_case columns to the camelCase summary DTO", () => {
    expect(rowToSummary(summaryRow)).toEqual({
      id: "sess-1",
      provider: "AWS",
      exam: "AWS SAA-C03",
      correct: 1,
      total: 1,
      percentage: 100,
      createdAt: "2026-06-19T10:00:00.000Z",
    });
  });
});

describe("rowToSaved", () => {
  it("includes the summary fields plus the round-tripped payload", () => {
    const row: SessionRow = { ...summaryRow, payload };
    const saved = rowToSaved(row);
    expect(saved.id).toBe("sess-1");
    expect(saved.createdAt).toBe("2026-06-19T10:00:00.000Z");
    expect(saved.payload).toEqual(payload);
    expect(saved.payload.answers[0]).toEqual({ questionId: "1", selectedOptionId: "a", correct: true });
  });
});

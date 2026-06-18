import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the OpenRouter module so its `astro:env/server` import is never evaluated
// under Node. `clientRef.current` lets each test choose the client (or null).
const { chatMock, clientRef } = vi.hoisted(() => ({
  chatMock: vi.fn<(args: unknown) => Promise<string>>(),
  clientRef: { current: null as null | { chat: (args: unknown) => Promise<string> } },
}));

vi.mock("@/lib/services/openrouter", () => ({
  createOpenRouterClient: () => clientRef.current,
}));

import { generateQuestions } from "@/lib/services/question-generator";

/** A schema-valid generation response with `count` questions. */
function validResponse(count: number, confidence: "high" | "low" = "high"): string {
  const questions = Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    stem: `Question ${i + 1}?`,
    options: [
      { id: "a", text: "Option A" },
      { id: "b", text: "Option B" },
      { id: "c", text: "Option C" },
      { id: "d", text: "Option D" },
    ],
    correctOptionId: "a",
    explanation: "Reasoning first, then why A is correct.",
    topic: "Some Domain",
  }));
  return JSON.stringify({ questions, confidence });
}

beforeEach(() => {
  chatMock.mockReset();
  clientRef.current = { chat: chatMock };
});

describe("generateQuestions", () => {
  it("returns ok with schema-conforming questions on valid output", async () => {
    chatMock.mockResolvedValueOnce(validResponse(3));

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 3 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions).toHaveLength(3);
      expect(result.confidence).toBe("high");
      expect(result.questions[0].options).toHaveLength(4);
      expect(result.questions[0].correctOptionId).toBe("a");
    }
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("rejects count above the cap before calling the provider", async () => {
    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 21 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-count");
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("rejects count below 1 before calling the provider", async () => {
    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-count");
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("returns not-configured when the client factory yields null", async () => {
    clientRef.current = null;

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 5 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not-configured");
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    chatMock.mockResolvedValueOnce("not json at all").mockResolvedValueOnce(validResponse(2));

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions).toHaveLength(2);
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("returns invalid-output when output is malformed twice", async () => {
    chatMock.mockResolvedValue("still not json");

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-output");
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("returns invalid-output when the question count does not match the request", async () => {
    chatMock.mockResolvedValue(validResponse(1)); // asked for 3, got 1, both attempts

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 3 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-output");
  });

  it("maps a provider/network throw to provider-error without retrying", async () => {
    chatMock.mockRejectedValue(new Error("network down"));

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("provider-error");
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a low confidence signal from the model", async () => {
    chatMock.mockResolvedValueOnce(validResponse(2, "low"));

    const result = await generateQuestions({ exam: "Obscure Cert XYZ", count: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.confidence).toBe("low");
  });

  it("strips a ```json fence before parsing", async () => {
    chatMock.mockResolvedValueOnce("```json\n" + validResponse(1) + "\n```");

    const result = await generateQuestions({ exam: "AWS SAA-C03", count: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions).toHaveLength(1);
  });
});

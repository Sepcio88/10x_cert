import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Question } from "@/types";

// Mock the SSR client + data-access so the route test never pulls in astro:env/server.
const { createClientMock, saveSessionMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({})),
  saveSessionMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));
vi.mock("@/lib/db/sessions", () => ({ saveSession: saveSessionMock }));

import { POST } from "@/pages/api/practice/sessions";

type Ctx = Parameters<typeof POST>[0];

function ctx({ user, body }: { user: unknown; body: unknown }): Ctx {
  return {
    locals: { user },
    cookies: {},
    request: new Request("http://localhost/api/practice/sessions", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  } as unknown as Ctx;
}

function q(id: string, correctOptionId: string): Question {
  return {
    id,
    stem: `Stem ${id}`,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
      { id: "d", text: "D" },
    ],
    correctOptionId,
    explanation: "Because.",
    topic: "Compute",
  };
}

const questions = [q("1", "a"), q("2", "b")];
const validBody = {
  provider: "AWS",
  exam: "SAA-C03",
  questions,
  answers: [
    { questionId: "1", selectedOptionId: "a" }, // correct
    { questionId: "2", selectedOptionId: "c" }, // wrong
  ],
};

beforeEach(() => {
  createClientMock.mockReset();
  createClientMock.mockReturnValue({});
  saveSessionMock.mockReset();
  saveSessionMock.mockResolvedValue({ ok: true, id: "sess-1" });
});

describe("POST /api/practice/sessions", () => {
  it("returns 401 and does not save when unauthenticated", async () => {
    const res = await POST(ctx({ user: null, body: validBody }));
    expect(res.status).toBe(401);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an unknown provider without saving", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, provider: "IBM" } }));
    expect(res.status).toBe(400);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an empty exam without saving", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, exam: "   " } }));
    expect(res.status).toBe(400);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON without saving", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: "not json{" }));
    expect(res.status).toBe(400);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("rejects a non-completed session (answers count != questions count)", async () => {
    const res = await POST(
      ctx({ user: { id: "u1" }, body: { ...validBody, answers: [{ questionId: "1", selectedOptionId: "a" }] } }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe("incomplete-session");
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("saves with a server-recomputed score and returns the new id", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: validBody }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: string };
    expect(data).toEqual({ ok: true, id: "sess-1" });

    expect(saveSessionMock).toHaveBeenCalledTimes(1);
    const [, userId, input] = saveSessionMock.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(userId).toBe("u1");
    // Score is recomputed server-side: 1 of 2 correct → 50%.
    expect(input.score).toEqual({ correct: 1, total: 2, percentage: 50 });
    // Persisted answers carry server-derived correctness, not a client-sent flag.
    expect((input.payload as { answers: { correct: boolean }[] }).answers).toEqual([
      { questionId: "1", selectedOptionId: "a", correct: true },
      { questionId: "2", selectedOptionId: "c", correct: false },
    ]);
  });
});

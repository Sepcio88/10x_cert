import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the engine so the route test never pulls in astro:env/server.
const { generateMock } = vi.hoisted(() => ({
  generateMock: vi.fn<(input: { exam: string; count: number }) => Promise<unknown>>(),
}));

vi.mock("@/lib/services/question-generator", () => ({
  generateQuestions: generateMock,
}));

import { POST } from "@/pages/api/practice/generate";

type Ctx = Parameters<typeof POST>[0];

function ctx({ user, body }: { user: unknown; body: unknown }): Ctx {
  return {
    locals: { user },
    request: new Request("http://localhost/api/practice/generate", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  } as unknown as Ctx;
}

const validBody = { provider: "AWS", exam: "SAA-C03", count: 5 };
const okResult = { ok: true, questions: [], confidence: "high" };

beforeEach(() => {
  generateMock.mockReset();
  generateMock.mockResolvedValue(okResult);
});

describe("POST /api/practice/generate", () => {
  it("returns 401 and does not call the engine when unauthenticated", async () => {
    const res = await POST(ctx({ user: null, body: validBody }));
    expect(res.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an unknown provider without calling the engine", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, provider: "IBM" } }));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an out-of-range count without calling the engine", async () => {
    for (const count of [0, 6]) {
      generateMock.mockClear();
      const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, count } }));
      expect(res.status).toBe(400);
      expect(generateMock).not.toHaveBeenCalled();
    }
  });

  it("returns 400 on an empty exam without calling the engine", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, exam: "   " } }));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed JSON body without calling the engine", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: "not json{" }));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("composes the exam identifier from provider + exam and returns the engine result", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: validBody }));
    expect(generateMock).toHaveBeenCalledWith({ exam: "AWS SAA-C03", count: 5 });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it("forwards optional target topics to the engine (S-05)", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, topics: ["Networking", "Security"] } }));
    expect(generateMock).toHaveBeenCalledWith({ exam: "AWS SAA-C03", count: 5, topics: ["Networking", "Security"] });
    expect(res.status).toBe(200);
  });

  it("rejects a non-string topic without calling the engine", async () => {
    const res = await POST(ctx({ user: { id: "u1" }, body: { ...validBody, topics: [123] } }));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("surfaces an engine error result as a 400 with the typed error", async () => {
    generateMock.mockResolvedValue({ ok: false, error: { code: "provider-error", message: "boom" } });
    const res = await POST(ctx({ user: { id: "u1" }, body: validBody }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe("provider-error");
  });
});

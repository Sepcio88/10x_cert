import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the SSR client + data-access so the route test never pulls in astro:env/server.
const { createClientMock, deleteSessionMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({})),
  deleteSessionMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));
vi.mock("@/lib/db/sessions", () => ({ deleteSession: deleteSessionMock }));

import { DELETE } from "@/pages/api/practice/sessions/[id]";

type Ctx = Parameters<typeof DELETE>[0];

function ctx({ user, id }: { user: unknown; id?: string }): Ctx {
  return {
    locals: { user },
    cookies: {},
    params: { id },
    request: new Request("http://localhost/api/practice/sessions/x", { method: "DELETE" }),
  } as unknown as Ctx;
}

beforeEach(() => {
  createClientMock.mockReset();
  createClientMock.mockReturnValue({});
  deleteSessionMock.mockReset();
  deleteSessionMock.mockResolvedValue({ ok: true });
});

describe("DELETE /api/practice/sessions/[id]", () => {
  it("returns 401 and does not delete when unauthenticated", async () => {
    const res = await DELETE(ctx({ user: null, id: "sess-1" }));
    expect(res.status).toBe(401);
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the id param is missing", async () => {
    const res = await DELETE(ctx({ user: { id: "u1" } }));
    expect(res.status).toBe(400);
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it("deletes the caller's session scoped to their user id", async () => {
    const res = await DELETE(ctx({ user: { id: "u1" }, id: "sess-1" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data).toEqual({ ok: true });
    expect(deleteSessionMock).toHaveBeenCalledTimes(1);
    const [, userId, id] = deleteSessionMock.mock.calls[0] as [unknown, string, string];
    expect(userId).toBe("u1");
    expect(id).toBe("sess-1");
  });

  it("surfaces a delete failure as a 500", async () => {
    deleteSessionMock.mockResolvedValue({ ok: false, error: "boom" });
    const res = await DELETE(ctx({ user: { id: "u1" }, id: "sess-1" }));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(false);
  });
});

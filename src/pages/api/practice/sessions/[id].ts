import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { deleteSession } from "@/lib/db/sessions";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Delete one of the caller's saved sessions. Auth-gated; RLS + the explicit user_id
 * filter in `deleteSession` mean a non-owned id is a no-op (never another user's row).
 */
export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ ok: false, error: { code: "unauthorized", message: "Sign in to delete sessions." } }, 401);
  }

  const id = context.params.id;
  if (!id) {
    return json({ ok: false, error: { code: "invalid-input", message: "Missing session id." } }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ ok: false, error: { code: "not-configured", message: "Storage is not configured." } }, 500);
  }

  const result = await deleteSession(supabase, context.locals.user.id, id);
  if (!result.ok) {
    return json({ ok: false, error: { code: "delete-failed", message: result.error } }, 500);
  }
  return json({ ok: true }, 200);
};

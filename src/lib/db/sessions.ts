import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import type { SavedSession, SavedSessionSummary, SessionPayload, SessionScore } from "@/types";

/**
 * Data-access for `practice_sessions` (S-03). Writes (`saveSession`/`deleteSession`)
 * return discriminated results in the project's style (mirrors `question-generator.ts`);
 * reads (`listSessions`/`getSession`) degrade to `[]`/`null` on failure — logged, not
 * surfaced — since the UI treats them as "no data." All queries isolate rows by `user_id`
 * explicitly as defense-in-depth atop RLS. The row↔DTO mappers are pure and exported so
 * they can be unit-tested without a live client.
 */

type Client = SupabaseClient<Database>;

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

export interface SaveSessionInput {
  provider: string;
  exam: string;
  payload: SessionPayload;
  score: SessionScore;
}

/** Columns selected for the history list (no payload). */
export interface SummaryRow {
  id: string;
  provider: string;
  exam: string;
  correct: number;
  total: number;
  percentage: number;
  created_at: string;
}

/** A full row including the JSONB payload, for the revisit view. */
export interface SessionRow extends SummaryRow {
  payload: SessionPayload;
}

const SUMMARY_COLUMNS = "id, provider, exam, correct, total, percentage, created_at";
const FULL_COLUMNS = `${SUMMARY_COLUMNS}, payload`;

/** Map a queryable row to a history-list summary DTO. */
export function rowToSummary(row: SummaryRow): SavedSessionSummary {
  return {
    id: row.id,
    provider: row.provider,
    exam: row.exam,
    correct: row.correct,
    total: row.total,
    percentage: row.percentage,
    createdAt: row.created_at,
  };
}

/** Map a full row (with payload) to a revisitable saved-session DTO. */
export function rowToSaved(row: SessionRow): SavedSession {
  return { ...rowToSummary(row), payload: row.payload };
}

export async function saveSession(client: Client, userId: string, input: SaveSessionInput): Promise<SaveResult> {
  const { data, error } = await client
    .from("practice_sessions")
    .insert({
      user_id: userId,
      provider: input.provider,
      exam: input.exam,
      correct: input.score.correct,
      total: input.score.total,
      percentage: input.score.percentage,
      payload: input.payload as unknown as Database["public"]["Tables"]["practice_sessions"]["Insert"]["payload"],
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
}

export async function listSessions(client: Client, userId: string): Promise<SavedSessionSummary[]> {
  const { data, error } = await client
    .from("practice_sessions")
    .select(SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console -- surface DB read failures; no logger abstraction yet
    console.error("listSessions failed:", error.message);
    return [];
  }
  return (data as SummaryRow[]).map(rowToSummary);
}

export async function getSession(client: Client, userId: string, id: string): Promise<SavedSession | null> {
  const { data, error } = await client
    .from("practice_sessions")
    .select(FULL_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console -- surface DB read failures; no logger abstraction yet
    console.error("getSession failed:", error.message);
    return null;
  }
  if (!data) {
    return null;
  }
  return rowToSaved(data as unknown as SessionRow);
}

export async function deleteSession(client: Client, userId: string, id: string): Promise<DeleteResult> {
  const { error } = await client.from("practice_sessions").delete().eq("user_id", userId).eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

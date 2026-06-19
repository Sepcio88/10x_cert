import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { SavedSessionSummary } from "@/types";

interface Props {
  sessions: SavedSessionSummary[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Reactive history list with a confirm-gated per-row delete. Owns the list state so a
 * deleted row disappears immediately (and the empty state appears once the last one is
 * removed). RLS makes the DELETE endpoint owner-scoped; the client just reflects success.
 */
export default function HistoryList({ sessions: initial }: Props) {
  const [sessions, setSessions] = useState<SavedSessionSummary[]>(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this saved session? This can't be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/practice/sessions/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean };
      if (res.ok && data.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else {
        setError("Couldn't delete that session. Please try again.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-blue-100/80">No saved sessions yet.</p>
        <a
          href="/practice"
          className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-purple-500"
        >
          Start practicing
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-200">{error}</p>
      )}
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-stretch gap-2">
            <a
              href={`/history/${s.id}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-purple-400/60"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-white">
                  {s.provider} — {s.exam}
                </span>
                <span className="block text-sm text-blue-100/60">
                  {formatDate(s.createdAt)} · {s.total} question{s.total === 1 ? "" : "s"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold text-white">
                  {s.correct} / {s.total}
                </span>
                <span className="block text-sm text-blue-100/60">{s.percentage}%</span>
              </span>
            </a>
            <button
              type="button"
              onClick={() => void handleDelete(s.id)}
              disabled={deletingId === s.id}
              aria-label={`Delete session: ${s.provider} ${s.exam}`}
              className="flex shrink-0 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-blue-100/60 transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

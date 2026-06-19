import { topicBreakdown } from "@/lib/practice/session";
import { cn } from "@/lib/utils";
import type { PracticeSession } from "@/types";

interface Props {
  session: PracticeSession;
}

/** Tint the bar by score: strong (green) / mixed (amber) / weak (red). */
function barColor(percentage: number): string {
  if (percentage >= 70) return "bg-green-500/70";
  if (percentage >= 40) return "bg-amber-500/70";
  return "bg-red-500/70";
}

/**
 * Per-topic/domain breakdown for a completed session (FR-008): one color-coded bar per
 * topic showing correct/total and %. Pure render over `topicBreakdown(session)`; reused on
 * both the live summary and the saved-session revisit. Renders nothing if there are no topics.
 */
export function TopicBreakdown({ session }: Props) {
  const rows = topicBreakdown(session);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-purple-300 uppercase">By topic</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.topic} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm text-blue-100/90">
              <span className="min-w-0 truncate">{row.topic}</span>
              <span className="shrink-0 text-blue-100/60">
                {row.correct}/{row.total} · {row.percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn("h-full rounded-full", barColor(row.percentage))}
                style={{ width: `${row.percentage}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

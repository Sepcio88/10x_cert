import { useMemo, useState } from "react";
import { groupByExam, mostRecentExam } from "@/lib/practice/progress";
import type { SavedSessionSummary } from "@/types";

interface Props {
  sessions: SavedSessionSummary[];
  /** Weak topics (sub-threshold, all-time) per exam; exams with none are absent (S-05). */
  weakTopicsByExam: Record<string, string[]>;
}

// SVG viewBox geometry. y-axis is FIXED to 0–100% (never auto-scaled) so small score
// wobbles don't look dramatic and a flat run reads as flat.
const W = 480;
const H = 180;
const PAD = 28;
const INNER_W = W - PAD * 2;
const INNER_H = H - PAD * 2;

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-purple-400 focus:outline-none";

function yFor(percentage: number): number {
  return PAD + INNER_H * (1 - percentage / 100);
}

/**
 * Per-exam progress trend (S-04, FR-010). Renders the selected exam's score-over-time as a
 * hand-rolled SVG line (raw % per session, oldest → newest), defaulting to the most recently
 * practiced exam with a dropdown switcher. Exams are never blended. Handles single-point and
 * zero-session cases honestly.
 */
export default function ProgressDashboard({ sessions, weakTopicsByExam }: Props) {
  const groups = useMemo(() => groupByExam(sessions), [sessions]);
  const [selectedExam, setSelectedExam] = useState<string | null>(() => mostRecentExam(groups));

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-blue-100/80">No sessions yet — your progress will show up here.</p>
        <a
          href="/practice"
          className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
        >
          Start practicing
        </a>
      </div>
    );
  }

  const selected = groups.find((g) => g.exam === selectedExam) ?? groups[0];
  const points = selected.points;
  const latest = points[points.length - 1];
  const single = points.length === 1;
  const weak = weakTopicsByExam[selected.exam] ?? [];
  const retryHref = `/practice?provider=${encodeURIComponent(selected.provider)}&exam=${encodeURIComponent(
    selected.exam,
  )}&topics=${encodeURIComponent(weak.join(","))}`;

  const coords = points.map((p, i) => ({
    x: PAD + (single ? INNER_W / 2 : (i / (points.length - 1)) * INNER_W),
    y: yFor(p.percentage),
    at: p.at,
    percentage: p.percentage,
  }));
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="exam-select" className="text-sm text-blue-100/80">
          Exam
        </label>
        <select
          id="exam-select"
          value={selected.exam}
          onChange={(e) => {
            setSelectedExam(e.target.value);
          }}
          className={inputClass + " max-w-xs"}
        >
          {groups.map((g) => (
            <option key={g.exam} value={g.exam} className="bg-slate-800">
              {g.provider} — {g.exam}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Score trend for ${selected.exam}`}>
          {/* 0 / 50 / 100% reference lines */}
          {[0, 50, 100].map((pct) => (
            <g key={pct}>
              <line
                x1={PAD}
                y1={yFor(pct)}
                x2={W - PAD}
                y2={yFor(pct)}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
              />
              <text x={4} y={yFor(pct) + 4} className="fill-blue-100/40 text-[10px]">
                {pct}
              </text>
            </g>
          ))}
          {!single && <polyline points={polyline} fill="none" stroke="#c084fc" strokeWidth={2} />}
          {coords.map((c) => (
            <circle key={c.at} cx={c.x} cy={c.y} r={4} fill="#c084fc">
              <title>{`${c.percentage}%`}</title>
            </circle>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-blue-100/70">
          {points.length} session{points.length === 1 ? "" : "s"} · latest {latest.percentage}%
        </span>
        <a href="/history" className="text-purple-300 transition-colors hover:text-purple-100 hover:underline">
          View all sessions
        </a>
      </div>

      {weak.length > 0 ? (
        <a
          href={retryHref}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
        >
          Retry weak topics ({weak.length})
        </a>
      ) : (
        <p className="text-sm text-blue-100/60">No weak topics for this exam yet — nice work.</p>
      )}

      {single && <p className="text-sm text-blue-100/60">Complete more sessions on this exam to see a trend.</p>}
    </div>
  );
}

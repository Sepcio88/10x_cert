import type { ExamProgress, SavedSessionSummary } from "@/types";

/**
 * Pure aggregation for the progress dashboard (S-04, FR-010). Groups a user's flat session
 * list into per-exam trends — exams are NEVER blended (PRD Open Question #2: averaging across
 * different exams misleads). No I/O; unit-tested in isolation.
 */

/** Group sessions by exam, each with score points ordered oldest → newest. Exam order = first appearance. */
export function groupByExam(sessions: SavedSessionSummary[]): ExamProgress[] {
  const order: string[] = [];
  const byExam = new Map<string, SavedSessionSummary[]>();
  for (const session of sessions) {
    let list = byExam.get(session.exam);
    if (list === undefined) {
      list = [];
      byExam.set(session.exam, list);
      order.push(session.exam);
    }
    list.push(session);
  }
  return order.map((exam) => {
    const list = byExam.get(exam) ?? [];
    const sorted = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // `sorted` is always non-empty: an exam enters `order` only when its first session is pushed.
    return {
      exam,
      provider: sorted[0].provider,
      points: sorted.map((s) => ({ at: s.createdAt, percentage: s.percentage })),
      latestAt: sorted[sorted.length - 1].createdAt,
    };
  });
}

/** The exam practiced most recently (by latest session), or null when there are no groups. */
export function mostRecentExam(groups: ExamProgress[]): string | null {
  let best: ExamProgress | null = null;
  for (const group of groups) {
    if (best === null || new Date(group.latestAt).getTime() > new Date(best.latestAt).getTime()) {
      best = group;
    }
  }
  return best?.exam ?? null;
}

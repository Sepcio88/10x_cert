import { topicBreakdown } from "@/lib/practice/session";
import type { ExamProgress, PracticeSession, SavedSession, SavedSessionSummary, SessionPayload } from "@/types";

/** A topic is "weak" when its all-time accuracy for an exam is below this percentage. */
export const WEAK_TOPIC_THRESHOLD = 70;

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

/**
 * Weak topics across a set of session payloads (S-05): aggregate per-topic correct/total
 * (reusing `topicBreakdown` per session), then return the topics whose all-time accuracy is
 * below `threshold`, ordered weakest-first so a small retry set targets the biggest gaps.
 */
export function weakTopics(payloads: SessionPayload[], threshold = WEAK_TOPIC_THRESHOLD): string[] {
  const acc = new Map<string, { correct: number; total: number }>();
  for (const payload of payloads) {
    const session: PracticeSession = {
      questions: payload.questions,
      currentIndex: payload.questions.length,
      answers: payload.answers,
    };
    for (const ts of topicBreakdown(session)) {
      const bucket = acc.get(ts.topic) ?? { correct: 0, total: 0 };
      acc.set(ts.topic, { correct: bucket.correct + ts.correct, total: bucket.total + ts.total });
    }
  }
  const weak: { topic: string; percentage: number }[] = [];
  for (const [topic, { correct, total }] of acc) {
    const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
    if (percentage < threshold) {
      weak.push({ topic, percentage });
    }
  }
  weak.sort((a, b) => a.percentage - b.percentage);
  return weak.map((w) => w.topic);
}

/** Weak topics per exam (never blended). Exams with no weak topics are omitted from the map. */
export function weakTopicsByExam(sessions: SavedSession[]): Record<string, string[]> {
  const byExam = new Map<string, SessionPayload[]>();
  for (const session of sessions) {
    const list = byExam.get(session.exam) ?? [];
    list.push(session.payload);
    byExam.set(session.exam, list);
  }
  const result: Record<string, string[]> = {};
  for (const [exam, payloads] of byExam) {
    const weak = weakTopics(payloads);
    if (weak.length > 0) {
      result[exam] = weak;
    }
  }
  return result;
}

import { SessionReview } from "@/components/practice/SessionReview";
import type { PracticeSession, SessionPayload } from "@/types";

interface Props {
  payload: SessionPayload;
}

/**
 * Render a saved session's revisit view by reconstructing a *complete* PracticeSession
 * from the stored payload (currentIndex past the last question) and handing it to the
 * same SessionReview used after a live session. `answers` stays index-aligned with
 * `questions`, which is the contract SessionReview relies on.
 */
export default function SavedSessionView({ payload }: Props) {
  const session: PracticeSession = {
    questions: payload.questions,
    currentIndex: payload.questions.length,
    answers: payload.answers,
  };
  return <SessionReview session={session} />;
}

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { QuestionCard } from "@/components/practice/QuestionCard";
import { getAnswer } from "@/lib/practice/session";
import type { PracticeSession } from "@/types";

interface Props {
  session: PracticeSession;
}

/**
 * Post-session recap: one collapsed row per question (number + correct/incorrect),
 * expanding to that question's locked feedback (highlighting + explanation) by
 * reusing the answered `QuestionCard`. Rows are independent and collapsed by default.
 */
export function SessionReview({ session }: Props) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {session.questions.map((question, index) => {
        const answer = getAnswer(session, index);
        const correct = answer?.correct ?? false;
        const isOpen = open.has(index);
        return (
          <div key={question.id} className="rounded-xl border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => {
                toggle(index);
              }}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-white"
            >
              <span className="flex items-center gap-2">
                {correct ? (
                  <CheckCircle2 className="size-4 text-green-300" />
                ) : (
                  <XCircle className="size-4 text-red-300" />
                )}
                <span className="font-medium">Q{index + 1}</span>
                <span className="text-sm text-blue-100/60">{question.topic}</span>
              </span>
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
            {isOpen && (
              <div className="border-t border-white/10 p-2">
                <QuestionCard
                  question={question}
                  index={index}
                  selectedOptionId={answer?.selectedOptionId ?? null}
                  answered
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

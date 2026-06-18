import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Question } from "@/types";

interface Props {
  question: Question;
  index: number;
  /** The option the user has selected (pre-submit) or that was recorded (post-submit); null if none yet. */
  selectedOptionId: string | null;
  /** True once the answer is submitted: options lock, highlighting + feedback appear. */
  answered: boolean;
  /** Pick an option. Ignored once `answered`. */
  onSelect?: (optionId: string) => void;
  /** Commit the selected option for grading. Shown only while unanswered. */
  onSubmit?: () => void;
}

/**
 * One question in the answering flow. While unanswered it shows selectable options
 * and a Submit button (disabled until a pick). Once answered it locks, highlights the
 * correct option (and a wrong pick), and leads with the explanation (FR-007).
 * Reused read-only (answered, no callbacks) by the Phase 3 review.
 */
export function QuestionCard({ question, index, selectedOptionId, answered, onSelect, onSubmit }: Props) {
  const isCorrect = answered && selectedOptionId === question.correctOptionId;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left text-white">
      <p className="mb-3 font-medium">
        <span className="text-purple-300">Q{index + 1}.</span> {question.stem}
      </p>

      <fieldset className="space-y-1 text-sm">
        <legend className="sr-only">Options for question {index + 1}</legend>
        {question.options.map((option) => {
          const isCorrectOption = answered && option.id === question.correctOptionId;
          const isWrongPick = answered && option.id === selectedOptionId && !isCorrect;
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
                !answered && "border-white/10 hover:border-purple-400/60",
                answered && "cursor-default",
                isCorrectOption && "border-green-500/50 bg-green-900/30",
                isWrongPick && "border-red-500/50 bg-red-900/30",
                answered && !isCorrectOption && !isWrongPick && "border-white/10 opacity-70",
              )}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.id}
                checked={selectedOptionId === option.id}
                disabled={answered}
                onChange={() => onSelect?.(option.id)}
                className="mt-1 accent-purple-500"
              />
              <span className="font-semibold text-blue-200 uppercase">{option.id}.</span>
              <span className="text-blue-100/90">{option.text}</span>
            </label>
          );
        })}
      </fieldset>

      {!answered && (
        <Button
          type="button"
          disabled={selectedOptionId === null}
          onClick={() => onSubmit?.()}
          className="mt-4 rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500"
        >
          Submit answer
        </Button>
      )}

      {answered && (
        <div className="mt-4 space-y-2">
          <p className={cn("flex items-center gap-2 font-semibold", isCorrect ? "text-green-300" : "text-red-300")}>
            {isCorrect ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {isCorrect ? "Correct" : "Incorrect"}
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="mb-1 text-xs font-semibold tracking-wide text-purple-300 uppercase">Why</p>
            <p className="text-sm text-blue-100/90">{question.explanation}</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-blue-100/50">Topic: {question.topic}</p>
    </div>
  );
}

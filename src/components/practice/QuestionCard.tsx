import type { Question } from "@/types";

interface Props {
  question: Question;
  index: number;
}

/** Read-only render of one generated question — stem, 4 options, topic. No answer revealed (that's S-02). */
export function QuestionCard({ question, index }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left text-white">
      <p className="mb-3 font-medium">
        <span className="text-purple-300">Q{index + 1}.</span> {question.stem}
      </p>
      <ul className="space-y-1 text-sm text-blue-100/80">
        {question.options.map((option) => (
          <li key={option.id} className="flex gap-2">
            <span className="font-semibold text-blue-200 uppercase">{option.id}.</span>
            <span>{option.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-blue-100/50">Topic: {question.topic}</p>
    </div>
  );
}

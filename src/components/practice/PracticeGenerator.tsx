import { useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { QuestionCard } from "@/components/practice/QuestionCard";
import type { Question, GenerationConfidence } from "@/types";

const PROVIDERS = ["AWS", "Azure", "GCP"] as const;
type Provider = (typeof PROVIDERS)[number];

// Mirrors the engine cap (MAX_QUESTION_COUNT) so the client rejects out-of-range before calling.
const MIN_COUNT = 1;
const MAX_COUNT = 20;

const ERROR_MESSAGES: Record<string, string> = {
  "not-configured": "AI generation isn't set up yet — an OpenRouter API key is required.",
  "provider-error": "Generation timed out or failed. Please try again.",
  "invalid-output": "The generated questions came back malformed. Please try again.",
  "invalid-count": `Please choose between ${MIN_COUNT} and ${MAX_COUNT} questions.`,
  "invalid-input": `Choose a provider, an exam, and between ${MIN_COUNT} and ${MAX_COUNT} questions.`,
  unauthorized: "Please sign in to generate questions.",
};

type ApiResponse =
  | { ok: true; questions: Question[]; confidence: GenerationConfidence }
  | { ok: false; error: { code: string; message: string } };

type Status = "idle" | "loading" | "done" | "error";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-blue-100/40 focus:border-purple-400 focus:outline-none";

export default function PracticeGenerator() {
  const [provider, setProvider] = useState<Provider>("AWS");
  const [exam, setExam] = useState("");
  const [count, setCount] = useState(10);
  const [status, setStatus] = useState<Status>("idle");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [confidence, setConfidence] = useState<GenerationConfidence>("high");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loading = status === "loading";
  const canSubmit = !loading && exam.trim() !== "" && count >= MIN_COUNT && count <= MAX_COUNT;

  async function generate() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, exam: exam.trim(), count }),
      });
      const data = (await res.json()) as ApiResponse;
      if (res.ok && data.ok) {
        setQuestions(data.questions);
        setConfidence(data.confidence);
        setStatus("done");
      } else {
        const code = !data.ok ? data.error.code : undefined;
        const fallback = !data.ok ? data.error.message : "Something went wrong. Please try again.";
        const friendly = code ? ERROR_MESSAGES[code] : undefined;
        setErrorMessage(friendly ?? fallback);
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error — please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void generate();
        }}
        className="space-y-4"
      >
        <fieldset disabled={loading} className="space-y-4">
          <div>
            <label htmlFor="provider" className="mb-1 block text-sm text-blue-100/80">
              Cloud provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as Provider);
              }}
              className={inputClass}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p} className="bg-slate-800">
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="exam" className="mb-1 block text-sm text-blue-100/80">
              Exam code or name
            </label>
            <input
              id="exam"
              type="text"
              value={exam}
              onChange={(e) => {
                setExam(e.target.value);
              }}
              placeholder="e.g. SAA-C03 or Solutions Architect Associate"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="count" className="mb-1 block text-sm text-blue-100/80">
              Number of questions ({MIN_COUNT}–{MAX_COUNT})
            </label>
            <input
              id="count"
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value));
              }}
              className={inputClass}
            />
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating your questions…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Generate questions
              </span>
            )}
          </Button>
        </fieldset>
      </form>

      {status === "error" && (
        <div className="space-y-3">
          <ServerError message={errorMessage} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void generate()}
            className="flex items-center gap-2 text-white"
          >
            <RotateCcw className="size-4" />
            Retry
          </Button>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-3">
          {confidence === "low" && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
              These questions may be less accurate — the exam wasn&apos;t clearly recognized. Double-check the exam code
              or name.
            </p>
          )}
          {questions.map((question, index) => (
            <QuestionCard key={question.id} question={question} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

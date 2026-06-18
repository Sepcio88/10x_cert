# F-01 Accuracy Spot-Check

Manual accuracy review of the question-generation engine. This is the human gate that
retires F-01's generation-feasibility risk (accuracy + latency) before S-01 is planned.

## How to run

1. Set a real `OPENROUTER_API_KEY` (in `.dev.vars` for Cloudflare local dev, and/or `.env`).
2. `npm run dev`
3. Request a set, e.g. `GET http://localhost:4321/api/dev/generate?exam=AWS%20SAA-C03&count=10`
   (the JSON response includes `elapsedMs`, `ok`, `questions`, `confidence`, or a typed `error`).
4. Also exercise the guardrails: `count=25` (expect `invalid-count`); unset the key and
   restart (expect `not-configured`); an obscure exam string (expect `confidence: "low"`).

## Results

| Field                          | Value |
| ------------------------------ | ----- |
| Exam tested                    |       |
| Count requested                |       |
| Observed latency (`elapsedMs`) |       |
| Confidence reported            |       |

### Per-question correctness (sampled)

| Q#  | Topic | Marked-correct option actually correct? (Y/N) | Notes |
| --- | ----- | --------------------------------------------- | ----- |
| 1   |       |                                               |       |
| 2   |       |                                               |       |
| 3   |       |                                               |       |

### Guardrail checks

| Check                                 | Result (Y/N) |
| ------------------------------------- | ------------ |
| `count=25` → `invalid-count`          |              |
| missing key → `not-configured`        |              |
| obscure exam → `confidence: "low"`    |              |
| set ready within ~10s                 |              |

## Verdict

- [ ] PASS — marked-correct answers are correct for the sampled subset and latency is within ~10s.
- [ ] FAIL — issues found (describe below).

Notes:

Reviewer: ___   Date: ___

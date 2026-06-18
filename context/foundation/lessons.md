# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## LLM latency scales with requested output volume — bound it, don't just cap-and-timeout

- **Context**: F-01/S-01 question generation — a single synchronous `gpt-4o-mini` call via OpenRouter, with a 9s timeout enforcing a `<10s` "set ready" NFR and a user-chosen count cap.
- **Problem**: A count cap (20) and a fixed latency timeout (9s) were set independently. At count 10 the generation ran ~9009ms and tripped the timeout, so two agreed decisions (max-count 20, response <10s) turned out to be mutually unsatisfiable with that model — discovered only at manual verification.
- **Rule**: When an LLM call produces variable-length output under a latency budget, treat output volume and the latency target as **one coupled decision**, not two. Pick a cap the chosen model can actually meet within the budget (measure, don't guess), or design for streaming / a faster model from the start. A fixed timeout + an aspirational count cap silently encodes a contradiction.
- **Applies to**: any feature that calls an LLM (or any variable-latency external service) to produce a sized result set under a response-time NFR — generation engines, summarizers, batch enrichers.

import { OPENROUTER_API_KEY } from "astro:env/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Bound a single request so the engine can honor the <10s "set ready" guardrail. */
const REQUEST_TIMEOUT_MS = 9000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}

export interface OpenRouterClient {
  /** Send a chat completion request and return the assistant message content as raw text. */
  chat(options: ChatCompletionOptions): Promise<string>;
}

/**
 * Returns an OpenRouter client, or `null` when `OPENROUTER_API_KEY` is not configured —
 * mirroring `src/lib/supabase.ts` so callers degrade gracefully instead of throwing on
 * a missing secret. Network/HTTP failures from `chat()` throw; the generator maps them
 * to a typed `provider-error`.
 */
export function createOpenRouterClient(): OpenRouterClient | null {
  if (!OPENROUTER_API_KEY) {
    return null;
  }

  return {
    async chat({ model, messages, temperature }) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, temperature }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;

        if (typeof content !== "string") {
          throw new Error("OpenRouter response missing message content");
        }

        return content;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

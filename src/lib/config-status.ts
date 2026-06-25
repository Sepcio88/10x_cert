import { SUPABASE_URL, SUPABASE_KEY, OPENROUTER_API_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

// NB: astro:env/server secrets resolve from the per-request runtime env on
// Cloudflare Workers — reading them at module scope always yields undefined.
// These MUST be computed inside a request (e.g. from a page's frontmatter),
// so they are functions, not module-level constants.
export function getConfigStatuses(): ConfigStatus[] {
  return [
    {
      name: "Supabase",
      configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
      message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
      docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
      docsLabel: "Zobacz instrukcję konfiguracji",
    },
    {
      name: "OpenRouter",
      configured: Boolean(OPENROUTER_API_KEY),
      message: "OpenRouter nie jest skonfigurowany — generowanie pytań jest wyłączone.",
      docsUrl: "https://openrouter.ai/docs/quickstart",
      docsLabel: "Zobacz instrukcję konfiguracji",
    },
  ];
}

export function getMissingConfigs(): ConfigStatus[] {
  return getConfigStatuses().filter((s) => !s.configured);
}

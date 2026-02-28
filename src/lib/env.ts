/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at build time / startup.
 * Import this module early to catch misconfiguration before runtime errors.
 */

function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  // ── Supabase (required) ───────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),

  // Supabase service role key — required for admin/server operations
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar("SUPABASE_SERVICE_ROLE_KEY", false),

  // ── Cron ──────────────────────────────────────────────────────────
  CRON_SECRET: getEnvVar("CRON_SECRET", false),

  // ── Data source adapter API keys (all optional) ───────────────────
  REPLICATE_API_TOKEN: getEnvVar("REPLICATE_API_TOKEN", false),
  OPENAI_API_KEY: getEnvVar("OPENAI_API_KEY", false),
  ANTHROPIC_API_KEY: getEnvVar("ANTHROPIC_API_KEY", false),
  GOOGLE_AI_API_KEY: getEnvVar("GOOGLE_AI_API_KEY", false),
  HUGGINGFACE_API_TOKEN: getEnvVar("HUGGINGFACE_API_TOKEN", false),
  CIVITAI_API_KEY: getEnvVar("CIVITAI_API_KEY", false),
  ARTIFICIAL_ANALYSIS_API_KEY: getEnvVar("ARTIFICIAL_ANALYSIS_API_KEY", false),

  // ── Stripe (optional — marketplace payments) ──────────────────────
  STRIPE_SECRET_KEY: getEnvVar("STRIPE_SECRET_KEY", false),
  STRIPE_WEBHOOK_SECRET: getEnvVar("STRIPE_WEBHOOK_SECRET", false),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: getEnvVar("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", false),

  // ── GitHub (optional — code quality agent) ──────────────────────
  GITHUB_TOKEN: getEnvVar("GITHUB_TOKEN", false),

  // ── Site ──────────────────────────────────────────────────────────
  NEXT_PUBLIC_SITE_URL:
    getEnvVar("NEXT_PUBLIC_SITE_URL", false) || "https://aimarketcap.com",
} as const;

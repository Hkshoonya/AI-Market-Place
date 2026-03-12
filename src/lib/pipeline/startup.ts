/**
 * Pipeline startup validation.
 *
 * Validates that required environment variables are present before the
 * pipeline runs. Two tiers of strictness:
 *
 *   Core secrets  — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
 *                   Missing → log error + process.exit(1) (non-test only)
 *
 *   Adapter secrets — per-adapter API keys from DATA_SOURCE_SEEDS
 *                     Missing → log warning, app continues in degraded mode
 *
 * Called once per process start via instrumentation.ts, after Sentry init.
 */

import { DATA_SOURCE_SEEDS } from "@/lib/data-sources/seed-config";
import { createTaggedLogger } from "@/lib/logging";

const log = createTaggedLogger("pipeline/startup");

/** Secrets that must be present for the app to function at all. */
const CORE_SECRETS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];

function isPresent(key: string): boolean {
  const val = process.env[key];
  return typeof val === "string" && val.length > 0;
}

export async function validatePipelineSecrets(): Promise<void> {
  // ── Check core secrets ──────────────────────────────────────────────────
  const missingCore = CORE_SECRETS.filter((k) => !isPresent(k));

  if (missingCore.length > 0) {
    void log.error(
      `Missing core secrets: ${missingCore.join(", ")} — app cannot start`,
      { missingCore }
    );
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }

  // ── Check adapter secrets ───────────────────────────────────────────────
  // Deduplicate across adapters (same key may appear in multiple adapters).
  const allAdapterKeys = Array.from(
    new Set(DATA_SOURCE_SEEDS.flatMap((s) => s.secret_env_keys))
  );

  const missingAdapter: { key: string; adapters: string[] }[] = [];
  for (const key of allAdapterKeys) {
    if (!isPresent(key)) {
      const affectedAdapters = DATA_SOURCE_SEEDS
        .filter((s) => s.secret_env_keys.includes(key))
        .map((s) => s.slug);
      missingAdapter.push({ key, adapters: affectedAdapters });
    }
  }

  for (const { key, adapters } of missingAdapter) {
    void log.warn(
      `Missing adapter secret ${key} — adapters will run in degraded/static mode`,
      { key, adapters }
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalSecrets = CORE_SECRETS.length + allAdapterKeys.length;
  const missingCount = missingCore.length + missingAdapter.length;
  const configuredCount = totalSecrets - missingCount;

  void log.info(
    `Pipeline secrets: ${configuredCount}/${totalSecrets} configured`,
    {
      configuredCount,
      totalSecrets,
      missingCore,
      missingAdapterKeys: missingAdapter.map((m) => m.key),
    }
  );
}

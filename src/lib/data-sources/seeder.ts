/**
 * Data sources seeder.
 *
 * Inserts all known adapter configurations into the data_sources table on
 * startup using INSERT … ON CONFLICT DO NOTHING. Existing rows are never
 * overwritten, so admin-edited values (tier, priority, etc.) are preserved.
 *
 * Called once per process start via instrumentation.ts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DATA_SOURCE_SEEDS } from "./seed-config";
import { loadAllAdapters, listAdapters } from "./registry";
import { createTaggedLogger } from "@/lib/logging";

const log = createTaggedLogger("data-sources/seeder");

export async function seedDataSources(): Promise<void> {
  // Ensure all adapters are registered so we can compare counts.
  await loadAllAdapters();

  const registryCount = listAdapters().length;
  const seedCount = DATA_SOURCE_SEEDS.length;

  if (registryCount !== seedCount) {
    void log.warn("Adapter count mismatch — seed-config.ts may be out of date", {
      registryCount,
      seedCount,
    });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("data_sources")
    .upsert(DATA_SOURCE_SEEDS, { onConflict: "slug", ignoreDuplicates: true });

  if (error) {
    // Table does not exist — migrations haven't run yet.
    if (error.code?.includes("42P01")) {
      console.error(
        "[data-sources/seeder] Table data_sources not found. Run Supabase migrations first."
      );
      if (process.env.NODE_ENV !== "test") {
        process.exit(1);
      }
      return;
    }

    // Other unexpected error — log but don't block startup.
    void log.error("Unexpected error seeding data_sources table", {
      code: error.code,
      message: error.message,
    });
    return;
  }

  void log.info(`Seeded ${seedCount} adapters, registry has ${registryCount} adapters`, {
    seedCount,
    registryCount,
  });
}

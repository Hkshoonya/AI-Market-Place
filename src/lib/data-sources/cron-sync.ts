import { NextResponse } from "next/server";
import { trackCronRun } from "@/lib/cron-tracker";
import {
  runSingleSync,
  runTierSync,
  type OrchestratorResult,
} from "./orchestrator";

export function createSyncCronSummary(result: OrchestratorResult) {
  const hasFailed = result.sourcesFailed > 0;

  return {
    tier: result.tier,
    sourcesRun: result.sourcesRun,
    sourcesSucceeded: result.sourcesSucceeded,
    sourcesFailed: result.sourcesFailed,
    details: result.details.map((detail) => ({
      source: detail.source,
      status: detail.status,
      records: detail.recordsProcessed,
      durationMs: detail.durationMs,
      errors: detail.errors.map((error) => error.message),
    })),
    overallStatus: hasFailed ? "partial" : "success",
  };
}

export async function executeTrackedSyncCronJob(input: {
  source?: string;
  tier?: number;
}): Promise<NextResponse> {
  const tracker = await trackCronRun(
    input.source ? `sync-source-${input.source}` : `sync-tier-${input.tier}`
  );

  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const result = input.source
      ? await runSingleSync(input.source)
      : await runTierSync(input.tier!);

    return tracker.complete(createSyncCronSummary(result));
  } catch (error) {
    return tracker.fail(error);
  }
}

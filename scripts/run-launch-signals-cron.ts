import { executeTrackedSyncCronJob } from "@/lib/data-sources/cron-sync";

const LAUNCH_SIGNAL_SOURCES = ["x-announcements", "provider-news"] as const;

async function main() {
  const results: Array<{
    source: string;
    status: number;
    ok: boolean;
    skipped: boolean;
    overallStatus?: string;
    error?: string;
  }> = [];

  for (const source of LAUNCH_SIGNAL_SOURCES) {
    const response = await executeTrackedSyncCronJob({ source });
    const body = (await response.json()) as Record<string, unknown>;

    results.push({
      source,
      status: response.status,
      ok: response.ok,
      skipped: body.skipped === true,
      overallStatus:
        typeof body.overallStatus === "string" ? body.overallStatus : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
    });
  }

  const failedResults = results.filter((result) => !result.ok);
  const summary = {
    ok: failedResults.length === 0,
    sourcesRun: results.length,
    sourcesFailed: failedResults.length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failedResults.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});

export type CronRunnerMode = "disabled" | "internal" | "external";

function isRailwayRuntime(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_STATIC_URL
  );
}

export function resolveCronRunnerMode(): CronRunnerMode {
  const rawMode = process.env.CRON_RUNNER_MODE?.trim().toLowerCase();

  if (
    rawMode === "disabled" ||
    rawMode === "internal" ||
    rawMode === "external"
  ) {
    return rawMode;
  }

  return isRailwayRuntime() ? "internal" : "external";
}

export function isCronSchedulerConfigured(
  mode = resolveCronRunnerMode()
): boolean {
  return mode !== "disabled";
}

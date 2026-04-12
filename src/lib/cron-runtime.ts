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
  const isRailway = isRailwayRuntime();

  if (rawMode === "disabled" || rawMode === "internal") {
    return rawMode;
  }

  if (rawMode === "external") {
    return isRailway ? "internal" : "external";
  }

  return isRailway ? "internal" : "external";
}

export function isCronSchedulerConfigured(
  mode = resolveCronRunnerMode()
): boolean {
  if (mode === "disabled") {
    return false;
  }

  return Boolean(process.env.CRON_SECRET?.trim());
}

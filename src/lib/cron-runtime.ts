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

  // Railway should be self-contained by default. If an old deployment still
  // carries CRON_RUNNER_MODE=external, coerce back to internal so scheduling
  // does not silently depend on an out-of-band VPS cron runner.
  if (rawMode === "external") {
    return isRailway ? "internal" : "external";
  }

  return isRailway ? "internal" : "external";
}

export function isCronSchedulerConfigured(
  mode = resolveCronRunnerMode()
): boolean {
  return mode !== "disabled";
}

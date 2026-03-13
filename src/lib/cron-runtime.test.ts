import { afterEach, describe, expect, it } from "vitest";

describe("cron runtime mode", () => {
  afterEach(() => {
    delete process.env.CRON_RUNNER_MODE;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_PROJECT_ID;
    delete process.env.RAILWAY_STATIC_URL;
  });

  it("defaults to external when no runtime markers are present", async () => {
    const { resolveCronRunnerMode } = await import("./cron-runtime");
    expect(resolveCronRunnerMode()).toBe("external");
  });

  it("defaults to internal on Railway when mode is not explicitly set", async () => {
    process.env.RAILWAY_ENVIRONMENT = "production";

    const { resolveCronRunnerMode } = await import("./cron-runtime");
    expect(resolveCronRunnerMode()).toBe("internal");
  });

  it("honors an explicit cron runner mode", async () => {
    process.env.CRON_RUNNER_MODE = "disabled";
    process.env.RAILWAY_ENVIRONMENT = "production";

    const { resolveCronRunnerMode } = await import("./cron-runtime");
    expect(resolveCronRunnerMode()).toBe("disabled");
  });
});

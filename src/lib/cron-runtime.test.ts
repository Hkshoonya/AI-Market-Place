import { afterEach, describe, expect, it } from "vitest";

describe("cron runtime mode", () => {
  afterEach(() => {
    delete process.env.CRON_RUNNER_MODE;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_PROJECT_ID;
    delete process.env.RAILWAY_STATIC_URL;
    delete process.env.CRON_SECRET;
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

  it("coerces explicit external mode back to internal on Railway", async () => {
    process.env.CRON_RUNNER_MODE = "external";
    process.env.RAILWAY_ENVIRONMENT = "production";

    const { resolveCronRunnerMode } = await import("./cron-runtime");
    expect(resolveCronRunnerMode()).toBe("internal");
  });

  it("honors explicit external mode outside Railway", async () => {
    process.env.CRON_RUNNER_MODE = "external";

    const { resolveCronRunnerMode } = await import("./cron-runtime");
    expect(resolveCronRunnerMode()).toBe("external");
  });

  it("treats the scheduler as unconfigured when CRON_SECRET is missing", async () => {
    const { isCronSchedulerConfigured } = await import("./cron-runtime");
    expect(isCronSchedulerConfigured("internal")).toBe(false);
    expect(isCronSchedulerConfigured("external")).toBe(false);
  });

  it("treats internal and external schedulers as configured when CRON_SECRET is present", async () => {
    process.env.CRON_SECRET = "test-secret";

    const { isCronSchedulerConfigured } = await import("./cron-runtime");
    expect(isCronSchedulerConfigured("internal")).toBe(true);
    expect(isCronSchedulerConfigured("external")).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime-environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects explicit e2e test mode", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    const { isE2ETestMode } = await import("./runtime-environment");
    expect(isE2ETestMode()).toBe(true);
  });

  it("detects playwright msw mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MSW", "true");
    const { isE2ETestMode } = await import("./runtime-environment");
    expect(isE2ETestMode()).toBe(true);
  });

  it("returns false outside e2e mode", async () => {
    const { isE2ETestMode } = await import("./runtime-environment");
    expect(isE2ETestMode()).toBe(false);
  });
});


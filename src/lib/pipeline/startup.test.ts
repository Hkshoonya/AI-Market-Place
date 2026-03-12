/**
 * Unit tests for pipeline/startup.ts
 *
 * Covers:
 * 1. validatePipelineSecrets() logs error and returns early on missing core secrets
 * 2. validatePipelineSecrets() logs warning for missing adapter secrets
 * 3. validatePipelineSecrets() logs summary: "Pipeline secrets: N/M configured"
 * 4. validatePipelineSecrets() does NOT exit in test env
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock DATA_SOURCE_SEEDS ─────────────────────────────────────────────────────

vi.mock("@/lib/data-sources/seed-config", () => ({
  DATA_SOURCE_SEEDS: [
    {
      slug: "adapter-with-key",
      name: "Adapter With Key",
      adapter_type: "adapter-with-key",
      description: "Test",
      tier: 2,
      sync_interval_hours: 24,
      priority: 10,
      secret_env_keys: ["MY_ADAPTER_KEY"],
      output_types: ["models"],
      is_enabled: true,
      config: {},
    },
    {
      slug: "free-adapter",
      name: "Free Adapter",
      adapter_type: "free-adapter",
      description: "Test",
      tier: 1,
      sync_interval_hours: 2,
      priority: 5,
      secret_env_keys: [],
      output_types: ["models"],
      is_enabled: true,
      config: {},
    },
  ],
}));

const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();
const mockLogError = vi.fn();

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: vi.fn(() => ({
    info: (...args: unknown[]) => mockLogInfo(...args),
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  })),
  systemLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("validatePipelineSecrets", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn() as unknown as typeof process.exit;

    // Set all required secrets by default
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("MY_ADAPTER_KEY", "adapter-key");
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.unstubAllEnvs();
  });

  it("does not call process.exit when all core secrets are present", async () => {
    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("logs error and returns early when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();

    expect(process.exit).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY"),
      expect.any(Object)
    );
    // Should return early — no summary log when core secrets missing
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  it("logs error and returns early when CRON_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");

    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();

    expect(process.exit).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining("CRON_SECRET"),
      expect.any(Object)
    );
  });

  it("logs error and returns early when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();

    expect(process.exit).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining("NEXT_PUBLIC_SUPABASE_URL"),
      expect.any(Object)
    );
  });

  it("does NOT call process.exit when core secrets are missing in test env", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("CRON_SECRET", "");

    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();

    expect(process.exit).not.toHaveBeenCalled();
  });

  it("logs a warning for missing adapter secrets but does not exit", async () => {
    vi.stubEnv("MY_ADAPTER_KEY", "");

    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();

    expect(process.exit).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining("MY_ADAPTER_KEY"),
      expect.any(Object)
    );
  });

  it("logs summary with configured/total count", async () => {
    const { validatePipelineSecrets } = await import("./startup");
    await validatePipelineSecrets();

    // Summary should show configured/total
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.stringMatching(/Pipeline secrets:.*\d+\/\d+/),
      expect.any(Object)
    );
  });
});

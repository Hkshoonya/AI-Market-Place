/**
 * Unit tests for data-sources/seeder.ts
 *
 * Covers:
 * 1. seedDataSources() calls upsert with correct data (ignoreDuplicates)
 * 2. Table-not-found error triggers process.exit(1) in non-test env
 * 3. Count mismatch between DATA_SOURCE_SEEDS and listAdapters() logs warning
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock dependencies ─────────────────────────────────────────────────────────

const mockUpsert = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

const mockLoadAllAdapters = vi.fn().mockResolvedValue(undefined);
const mockListAdapters = vi.fn().mockReturnValue([
  "openrouter-models",
  "huggingface",
  "openai-models",
]);

vi.mock("@/lib/data-sources/registry", () => ({
  loadAllAdapters: () => mockLoadAllAdapters(),
  listAdapters: () => mockListAdapters(),
}));

vi.mock("@/lib/data-sources/seed-config", () => ({
  DATA_SOURCE_SEEDS: [
    {
      slug: "openrouter-models",
      name: "OpenRouter Models",
      adapter_type: "openrouter-models",
      description: "Test adapter",
      tier: 1,
      sync_interval_hours: 6,
      priority: 5,
      secret_env_keys: [],
      output_types: ["models"],
      is_enabled: true,
      config: {},
    },
    {
      slug: "huggingface",
      name: "HuggingFace",
      adapter_type: "huggingface",
      description: "Test adapter",
      tier: 1,
      sync_interval_hours: 6,
      priority: 15,
      secret_env_keys: [],
      output_types: ["models"],
      is_enabled: true,
      config: {},
    },
    {
      slug: "openai-models",
      name: "OpenAI Models",
      adapter_type: "openai-models",
      description: "Test adapter",
      tier: 1,
      sync_interval_hours: 2,
      priority: 25,
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

describe("seedDataSources", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn() as unknown as typeof process.exit;
    // Default: upsert succeeds with no error
    mockUpsert.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.unstubAllEnvs();
  });

  it("calls upsert with ignoreDuplicates: true and all seed entries", async () => {
    const { seedDataSources } = await import("./seeder");
    await seedDataSources();

    expect(mockFrom).toHaveBeenCalledWith("data_sources");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ slug: "openrouter-models" }),
        expect.objectContaining({ slug: "huggingface" }),
        expect.objectContaining({ slug: "openai-models" }),
      ]),
      expect.objectContaining({
        onConflict: "slug",
        ignoreDuplicates: true,
      })
    );
  });

  it("does NOT call process.exit on success", async () => {
    const { seedDataSources } = await import("./seeder");
    await seedDataSources();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("calls process.exit(1) on table-not-found error in non-test env", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockUpsert.mockResolvedValue({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });

    const { seedDataSources } = await import("./seeder");
    await seedDataSources();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("does NOT call process.exit on table-not-found in test env", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockUpsert.mockResolvedValue({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });

    const { seedDataSources } = await import("./seeder");
    await seedDataSources();

    expect(process.exit).not.toHaveBeenCalled();
  });

  it("logs warning when registry adapter count differs from seed count", async () => {
    // listAdapters returns 4 but seeds has 3 → mismatch
    mockListAdapters.mockReturnValueOnce([
      "openrouter-models",
      "huggingface",
      "openai-models",
      "extra-adapter",
    ]);

    const { seedDataSources } = await import("./seeder");
    await seedDataSources();

    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining("mismatch"),
      expect.any(Object)
    );
  });

  it("logs a summary after successful seeding", async () => {
    const { seedDataSources } = await import("./seeder");
    await seedDataSources();

    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.stringContaining("Seeded"),
      expect.any(Object)
    );
  });
});

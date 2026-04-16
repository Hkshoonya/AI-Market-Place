/**
 * Unit tests for data-sources/orchestrator.ts
 *
 * Covers:
 * 1. Adapter failure triggers systemLog.error with correct metadata
 * 2. 3+ consecutive failures triggers Sentry.captureMessage with correct tags/extra
 * 3. 1-2 consecutive failures does NOT trigger Sentry
 * 4. Missing secrets logs warning before adapter execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Sentry ────────────────────────────────────────────────────────────────

const mockSentryCaptureMessage = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => mockSentryCaptureMessage(...args),
}));

// ── Mock logging ───────────────────────────────────────────────────────────────

const mockSystemLogError = vi.fn();
const mockSystemLogWarn = vi.fn();
const mockSystemLogInfo = vi.fn();

vi.mock("@/lib/logging", () => ({
  systemLog: {
    error: (...args: unknown[]) => mockSystemLogError(...args),
    warn: (...args: unknown[]) => mockSystemLogWarn(...args),
    info: (...args: unknown[]) => mockSystemLogInfo(...args),
  },
}));

// ── Mock pipeline-health ───────────────────────────────────────────────────────

let mockRecordSyncFailureResult = 1;
const mockRecordSyncFailure = vi.fn().mockImplementation(() =>
  Promise.resolve(mockRecordSyncFailureResult)
);
const mockRecordSyncSuccess = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/pipeline-health", () => ({
  recordSyncFailure: (...args: unknown[]) => mockRecordSyncFailure(...args),
  recordSyncSuccess: (...args: unknown[]) => mockRecordSyncSuccess(...args),
}));

// ── Mock registry ──────────────────────────────────────────────────────────────

const mockAdapter = {
  id: "test-adapter",
  name: "Test Adapter",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],
  sync: vi.fn(),
  healthCheck: vi.fn(),
};

const mockGetAdapter = vi.fn().mockReturnValue(mockAdapter);
const mockLoadAllAdapters = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/data-sources/registry", () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
  loadAllAdapters: (...args: unknown[]) => mockLoadAllAdapters(...args),
}));

const mockAcquireCronLock = vi.fn().mockResolvedValue({
  acquired: true,
  mode: "locked",
  token: "test-lock",
  release: vi.fn().mockResolvedValue(undefined),
});

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: (...args: unknown[]) => mockAcquireCronLock(...args),
}));

// ── Mock Supabase ──────────────────────────────────────────────────────────────

const _mockUpsertFn = vi.fn().mockResolvedValue({ error: null });
function createUpdateChain() {
  const chain = {
    eq: vi.fn().mockReturnValue(undefined),
    lt: vi.fn().mockReturnValue(undefined),
  };

  chain.eq.mockImplementation(() => chain);
  chain.lt.mockResolvedValue({ error: null });
  return chain;
}

const mockUpdateFn = vi.fn().mockImplementation(() => createUpdateChain());
const _mockSelectFn = vi.fn().mockReturnValue({
  single: vi.fn().mockResolvedValue({ data: { id: "job-123" }, error: null }),
});
const mockInsertFn = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: "job-123" }, error: null }),
  }),
});

const mockDataSourcesFrom = {
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
};

const mockSyncJobsFrom = {
  insert: mockInsertFn,
  update: mockUpdateFn,
};

const mockSupabaseClient = {
  from: vi.fn().mockImplementation((table: string) => {
    if (table === "sync_jobs") return mockSyncJobsFrom;
    if (table === "data_sources") return mockDataSourcesFrom;
    return { select: vi.fn(), update: vi.fn(), insert: vi.fn() };
  }),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// ── Mock utils ─────────────────────────────────────────────────────────────────

const mockResolveSecrets = vi.fn().mockReturnValue({ secrets: {}, missing: [] });
const mockNeedsSync = vi.fn().mockReturnValue(true);
const mockHasPermanentSyncError = vi.fn().mockReturnValue(false);

vi.mock("@/lib/data-sources/utils", () => ({
  resolveSecrets: (...args: unknown[]) => mockResolveSecrets(...args),
  needsSync: (...args: unknown[]) => mockNeedsSync(...args),
  hasPermanentSyncError: (...args: unknown[]) => mockHasPermanentSyncError(...args),
}));

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<{
  slug: string;
  adapter_type: string;
  tier: number;
  secret_env_keys: string[];
  last_sync_at: string | null;
  sync_interval_hours: number;
  config: Record<string, unknown>;
}> = {}) {
  return {
    id: "src-1",
    slug: overrides.slug ?? "test-adapter",
    adapter_type: overrides.adapter_type ?? "test-adapter",
    tier: overrides.tier ?? 1,
    is_enabled: true,
    priority: 1,
    last_sync_at: overrides.last_sync_at ?? null,
    sync_interval_hours: overrides.sync_interval_hours ?? 24,
    secret_env_keys: overrides.secret_env_keys ?? [],
    config: overrides.config ?? {},
    name: "Test",
    description: "Test adapter",
    output_types: ["models"],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("orchestrator — Sentry alerting and structured failure logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordSyncFailureResult = 1;
    mockHasPermanentSyncError.mockReturnValue(false);
    mockAdapter.sync.mockResolvedValue({
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [{ message: "API connection failed" }],
    });
    mockLoadAllAdapters.mockResolvedValue(undefined);
    // Reset data_sources mock to return one source
    mockDataSourcesFrom.select.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [makeSource()],
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("recovers stale running sync jobs before starting a tier sync", async () => {
    const { runTierSync } = await import("./orchestrator");
    await runTierSync(1);

    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: expect.stringContaining("exceeding 6h"),
        metadata: expect.objectContaining({
          stale_recovered: true,
          stale_timeout_hours: 6,
        }),
      })
    );
  });

  it("logs systemLog.error for every adapter failure with full metadata", async () => {
    const { runTierSync } = await import("./orchestrator");

    mockRecordSyncFailureResult = 1;
    await runTierSync(1);

    expect(mockSystemLogError).toHaveBeenCalledWith(
      "sync-orchestrator",
      "Adapter sync failed",
      expect.objectContaining({
        adapter: "test-adapter",
        adapter_type: "test-adapter",
        tier: 1,
        consecutiveFailures: 1,
        error: "API connection failed",
      })
    );
  });

  it("does NOT fire Sentry.captureMessage when consecutive failures is 1", async () => {
    const { runTierSync } = await import("./orchestrator");

    mockRecordSyncFailureResult = 1;
    await runTierSync(1);

    expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
  });

  it("does NOT fire Sentry.captureMessage when consecutive failures is 2", async () => {
    const { runTierSync } = await import("./orchestrator");

    mockRecordSyncFailureResult = 2;
    await runTierSync(1);

    expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
  });

  it("fires Sentry.captureMessage with correct tags at 3 consecutive failures", async () => {
    const { runTierSync } = await import("./orchestrator");

    mockRecordSyncFailureResult = 3;
    await runTierSync(1);

    expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
      "Pipeline adapter consecutive failures: test-adapter",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          adapter: "test-adapter",
          adapter_type: "test-adapter",
          tier: "1",
        }),
        extra: expect.objectContaining({
          consecutiveFailures: 3,
          lastError: "API connection failed",
        }),
      })
    );
  });

  it("fires Sentry.captureMessage with correct tags at 5 consecutive failures", async () => {
    const { runTierSync } = await import("./orchestrator");

    mockRecordSyncFailureResult = 5;
    await runTierSync(1);

    expect(mockSentryCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
      "Pipeline adapter consecutive failures: test-adapter",
      expect.objectContaining({
        level: "warning",
        extra: expect.objectContaining({
          consecutiveFailures: 5,
        }),
      })
    );
  });

  it("logs systemLog.warn when adapter secrets are missing", async () => {
    mockResolveSecrets.mockReturnValueOnce({
      secrets: {},
      missing: ["TEST_API_KEY"],
    });

    const { runTierSync } = await import("./orchestrator");
    await runTierSync(1);

    expect(mockSystemLogWarn).toHaveBeenCalledWith(
      "sync-orchestrator",
      expect.stringContaining("missing secrets"),
      expect.objectContaining({
        missingSecrets: ["TEST_API_KEY"],
      })
    );
  });

  it("does NOT log systemLog.error for a successful adapter sync", async () => {
    mockAdapter.sync.mockResolvedValueOnce({
      success: true,
      recordsProcessed: 10,
      recordsCreated: 5,
      recordsUpdated: 5,
      errors: [],
    });

    const { runTierSync } = await import("./orchestrator");
    await runTierSync(1);

    // systemLog.error should not be called for sync-orchestrator Adapter sync failed
    const adapterErrorCalls = mockSystemLogError.mock.calls.filter(
      (call) => call[1] === "Adapter sync failed"
    );
    expect(adapterErrorCalls).toHaveLength(0);
    expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
  });

  it("does not update last_sync_at on a failed sync attempt", async () => {
    const { runTierSync } = await import("./orchestrator");
    await runTierSync(1);

    expect(mockDataSourcesFrom.update).toHaveBeenCalledWith(
      expect.not.objectContaining({
        last_sync_at: expect.any(String),
      })
    );
  });

  it("records source sync intervals when marking pipeline health", async () => {
    const { runTierSync } = await import("./orchestrator");

    mockAdapter.sync.mockResolvedValueOnce({
      success: true,
      recordsProcessed: 5,
      recordsCreated: 5,
      recordsUpdated: 0,
      errors: [],
    });

    await runTierSync(1);

    expect(mockRecordSyncSuccess).toHaveBeenCalledWith("test-adapter", 24);
  });

  it("clears last_error_message when a sync succeeds with non-fatal warnings", async () => {
    mockAdapter.sync.mockResolvedValueOnce({
      success: true,
      recordsProcessed: 12,
      recordsCreated: 0,
      recordsUpdated: 8,
      errors: [{ message: "Repo not found: example/missing", context: "warning" }],
      metadata: {
        warningCount: 1,
      },
    });

    const { runTierSync } = await import("./orchestrator");
    await runTierSync(1);

    expect(mockDataSourcesFrom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_sync_status: "success",
        last_error_message: null,
        last_sync_records: 12,
      })
    );
  });

  it("quarantines sources after permanent upstream failures", async () => {
    mockAdapter.sync.mockResolvedValueOnce({
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [{ message: "dataset is private or gated", context: "permanent_upstream_failure" }],
    });
    mockHasPermanentSyncError.mockReturnValueOnce(true);

    const { runTierSync } = await import("./orchestrator");
    await runTierSync(1);

    expect(mockDataSourcesFrom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quarantined_at: expect.any(String),
        quarantine_reason: "dataset is private or gated",
        last_error_message: expect.stringContaining("Quarantined after permanent upstream failure"),
      })
    );
    expect(mockSystemLogWarn).toHaveBeenCalledWith(
      "sync-orchestrator",
      "Adapter quarantined after permanent upstream failure",
      expect.objectContaining({
        adapter: "test-adapter",
      })
    );
  });

  it("skips an adapter when another sync already holds its source lock", async () => {
    mockAcquireCronLock.mockResolvedValueOnce({
      acquired: false,
      mode: "locked",
      token: null,
      release: vi.fn().mockResolvedValue(undefined),
    });

    const { runTierSync } = await import("./orchestrator");
    const result = await runTierSync(1);

    expect(result.details[0]).toEqual(
      expect.objectContaining({
        source: "test-adapter",
        status: "skipped",
        recordsProcessed: 0,
        errors: [{ message: "Adapter sync already running for test-adapter" }],
      })
    );
    expect(mockAdapter.sync).not.toHaveBeenCalled();
  });
});

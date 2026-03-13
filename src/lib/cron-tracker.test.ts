import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();
const mockAcquireCronLock = vi.fn();
const mockReleaseLock = vi.fn().mockResolvedValue(undefined);
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: (...args: unknown[]) => mockAcquireCronLock(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => mockLogger,
}));

function createUpdateChain(result: unknown) {
  return {
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue(result),
  };
}

function createInsertChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe("trackCronRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAcquireCronLock.mockResolvedValue({
      acquired: true,
      mode: "locked",
      token: "lock-token",
      release: mockReleaseLock,
    });
  });

  it("returns shouldSkip when the advisory cron lock is already held", async () => {
    mockAcquireCronLock.mockResolvedValueOnce({
      acquired: false,
      mode: "locked",
      token: null,
      release: mockReleaseLock,
    });

    const { trackCronRun } = await import("./cron-tracker");
    const tracker = await trackCronRun("compute-scores");

    expect(tracker.shouldSkip).toBe(true);
    const response = await tracker.skip();
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      reason: "already_running",
      jobName: "compute-scores",
    });
  });

  it("returns shouldSkip when the running-row unique guard conflicts", async () => {
    const updateChain = createUpdateChain({ error: null });
    const insertChain = createInsertChain({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => updateChain),
        insert: vi.fn(() => insertChain),
      })),
    });

    const { trackCronRun } = await import("./cron-tracker");
    const tracker = await trackCronRun("compute-scores");

    expect(tracker.shouldSkip).toBe(true);
    const response = await tracker.skip();
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      reason: "already_running",
      jobName: "compute-scores",
    });
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it("marks stale runs failed before inserting a new running row", async () => {
    const updateChain = createUpdateChain({ error: null });
    const insertChain = createInsertChain({
      data: { id: "run-1" },
      error: null,
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => updateChain),
        insert: vi.fn(() => insertChain),
      })),
    });

    const { trackCronRun } = await import("./cron-tracker");
    const tracker = await trackCronRun("sync-tier-1", { staleAfterMs: 60_000 });

    expect(tracker.shouldSkip).toBe(false);
    expect(tracker.runId).toBe("run-1");
    expect(updateChain.eq).toHaveBeenNthCalledWith(1, "job_name", "sync-tier-1");
    expect(updateChain.eq).toHaveBeenNthCalledWith(2, "status", "running");
    expect(updateChain.lt).toHaveBeenCalledWith("started_at", expect.any(String));
  });
});

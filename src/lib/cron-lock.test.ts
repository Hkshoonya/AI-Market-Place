import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();
const mockCreateAdminClient = vi.fn(() => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => mockLogger,
}));

describe("cron lock helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.CRON_SINGLE_RUN_LOCK;
    delete process.env.CRON_LOCK_TTL_SECONDS;
  });

  it("degrades open when locking is explicitly disabled", async () => {
    process.env.CRON_SINGLE_RUN_LOCK = "false";

    const { acquireCronLock } = await import("./cron-lock");

    const lock = await acquireCronLock("sync-tier-1");

    expect(lock.acquired).toBe(true);
    expect(lock.mode).toBe("disabled");
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it("acquires and releases a lock via RPC when enabled", async () => {
    process.env.CRON_SINGLE_RUN_LOCK = "true";
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    const { acquireCronLock } = await import("./cron-lock");

    const lock = await acquireCronLock("compute-scores");

    expect(lock.acquired).toBe(true);
    expect(lock.mode).toBe("locked");
    expect(mockRpc).toHaveBeenNthCalledWith(1, "acquire_cron_lock", {
      p_job_name: "compute-scores",
      p_lock_token: expect.any(String),
      p_ttl_seconds: 900,
    });

    await lock.release();

    expect(mockRpc).toHaveBeenNthCalledWith(2, "release_cron_lock", {
      p_job_name: "compute-scores",
      p_lock_token: expect.any(String),
    });
  });

  it("returns an unacquired lock when another run already holds it", async () => {
    process.env.CRON_SINGLE_RUN_LOCK = "true";
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const { acquireCronLock } = await import("./cron-lock");

    const lock = await acquireCronLock("agent-pipeline-engineer");

    expect(lock.acquired).toBe(false);
    expect(lock.mode).toBe("locked");
  });

  it("degrades open when the RPC errors", async () => {
    process.env.CRON_SINGLE_RUN_LOCK = "true";
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "function public.acquire_cron_lock does not exist" },
    });

    const { acquireCronLock } = await import("./cron-lock");

    const lock = await acquireCronLock("sync-tier-2");

    expect(lock.acquired).toBe(true);
    expect(lock.mode).toBe("unavailable");
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

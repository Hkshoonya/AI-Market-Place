import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "@/types/database";

const { check } = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("./health", () => ({ checkAffiliateDestination: check }));
import { maintainAffiliateLinks } from "./maintenance";

const healthy = { ok: true, status: "healthy", httpStatus: 200, error: null };
const link = { id: "link", platform_id: "platform", destination_url: "https://runpod.io/?ref=owner", consecutive_failures: 2, status: "active", updated_at: "2026-09-06T21:00:00Z" };

function database(overrides: Partial<typeof link> = {}) {
  const updateResult = { data: { id: link.id } as { id: string } | null, error: null as Error | null };
  const updateQuery = {
    eq: vi.fn(() => updateQuery),
    select: vi.fn(() => updateQuery),
    maybeSingle: vi.fn(async () => updateResult),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(updateResult).then(resolve),
  };
  const update = vi.fn(() => updateQuery);
  const query = {
    select: vi.fn(() => query), in: vi.fn(() => query), order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: [{ ...link, ...overrides }], error: null })),
    eq: vi.fn(() => query), or: vi.fn(() => query), update,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: 1, error: null }).then(resolve),
  };
  const from = vi.fn(() => query);
  return { supabase: { from } as unknown as TypedSupabaseClient, from, update, updateQuery, updateResult };
}

describe("affiliate maintenance safeguards", () => {
  beforeEach(() => { vi.clearAllMocks(); check.mockResolvedValue(healthy); });

  it("does not query or change links when the job has already been cancelled", async () => {
    const db = database();
    await expect(maintainAffiliateLinks({ supabase: db.supabase, signal: AbortSignal.abort() })).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });

  it("does not count a cancelled check as a failed destination or invalidate it", async () => {
    const db = database();
    const controller = new AbortController();
    check.mockImplementation(async () => {
      controller.abort();
      return { ok: false, status: "failed", httpStatus: null, error: "aborted" };
    });
    await expect(maintainAffiliateLinks({ supabase: db.supabase, signal: controller.signal })).rejects.toThrow();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does not overwrite an admin pause or destination edit made during the check", async () => {
    const db = database();
    db.updateResult.data = null;
    const result = await maintainAffiliateLinks({ supabase: db.supabase });
    expect(db.updateQuery.eq).toHaveBeenCalledWith("status", link.status);
    expect(db.updateQuery.eq).toHaveBeenCalledWith("destination_url", link.destination_url);
    expect(db.updateQuery.eq).toHaveBeenCalledWith("consecutive_failures", link.consecutive_failures);
    expect(db.updateQuery.eq).toHaveBeenCalledWith("updated_at", link.updated_at);
    expect(result.checked).toBe(0);
    expect(db.from).not.toHaveBeenCalledWith("deployment_platforms");
  });

  it("records a successful check and resets failures for an unchanged link", async () => {
    const db = database();
    const result = await maintainAffiliateLinks({ supabase: db.supabase });
    expect(result).toMatchObject({ checked: 1, healthy: 1, failed: 0, errors: [] });
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ status: "active", consecutive_failures: 0 }));
  });

  it.each([
    { consecutive_failures: 0, expectedStatus: "active", invalidated: 0 },
    { consecutive_failures: 2, expectedStatus: "invalid", invalidated: 1 },
  ])("only invalidates after the failure threshold: %j", async ({ consecutive_failures, expectedStatus, invalidated }) => {
    const db = database({ consecutive_failures });
    check.mockResolvedValue({ ok: false, status: "failed", httpStatus: 500, error: "Destination returned HTTP 500" });
    const result = await maintainAffiliateLinks({ supabase: db.supabase });
    expect(result).toMatchObject({ checked: 1, failed: 1, invalidated });
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ status: expectedStatus, consecutive_failures: consecutive_failures + 1 }));
  });

  it("returns a recovered invalid link to draft, never automatically to active", async () => {
    const db = database({ status: "invalid" });
    expect(await maintainAffiliateLinks({ supabase: db.supabase })).toMatchObject({ checked: 1, healthy: 1, recovered: 1 });
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ status: "draft", consecutive_failures: 0 }));
  });

  it("does not report a check as saved when its database write fails", async () => {
    const db = database();
    db.updateResult.error = new Error("Write failed");
    expect(await maintainAffiliateLinks({ supabase: db.supabase })).toMatchObject({ checked: 0, healthy: 0, errors: ["Write failed"] });
    expect(db.from).not.toHaveBeenCalledWith("deployment_platforms");
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ authDelete: vi.fn(), signOut: vi.fn(), deleteData: vi.fn(), podCount: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }), RATE_LIMITS: { auth: {} }, getClientIp: () => "127.0.0.1", rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/logging", () => ({ systemLog: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user1" } } }), signOut: m.signOut },
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, or: () => query, update: () => query,
      delete: () => { m.deleteData(table); return query; },
      single: async () => ({ data: { balance: 0, held_balance: 0 }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return query;
  },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  auth: { admin: { deleteUser: m.authDelete } },
  from: () => ({ select: () => ({ eq: () => ({ not: async () => ({ count: m.podCount, error: null }) }) }) }),
}) }));
import { POST } from "./route";
const request = () => new NextRequest("https://aimarketcap.tech/api/auth/delete-account", { method: "POST", headers: { origin: "https://aimarketcap.tech", "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
beforeEach(() => { vi.clearAllMocks(); m.podCount = 0; m.authDelete.mockResolvedValue({ error: null }); });
describe("account deletion with billable resources", () => {
  it("blocks before deleting any data or signing out if a Pod may still exist", async () => {
    m.podCount = 1;
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("Terminate your Runpod Pods");
    expect(m.deleteData).not.toHaveBeenCalled(); expect(m.authDelete).not.toHaveBeenCalled(); expect(m.signOut).not.toHaveBeenCalled();
  });
  it("does not falsely report completion if the final identity deletion is rejected", async () => {
    m.authDelete.mockResolvedValue({ error: { message: "active resource guard" } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("deletion did not complete");
    expect(m.signOut).not.toHaveBeenCalled();
  });
  it("signs out only after identity deletion succeeds", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true });
    expect(m.authDelete).toHaveBeenCalledWith("user1"); expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.authDelete.mock.invocationCallOrder[0]).toBeLessThan(m.signOut.mock.invocationCallOrder[0]);
  });
});

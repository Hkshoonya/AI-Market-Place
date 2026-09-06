import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), lease: vi.fn(), reconcile: vi.fn(), verify: vi.fn(), limit: vi.fn(), order: vi.fn(), lt: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("./config", () => ({ getDataBillingConfig: () => ({}) }));
vi.mock("./store", () => ({ withBillingLease: mocks.lease }));
vi.mock("./subscriptions", () => ({ reconcileSubscription: mocks.reconcile }));
vi.mock("./stripe", () => ({ verifyBillingAccount: mocks.verify }));
import { reconcileDataBilling } from "./reconcile";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("DATA_API_BILLING_RECONCILE_ENABLED", "true");
  const query = { select: () => query, not: () => query, lt: mocks.lt, order: mocks.order, limit: mocks.limit };
  mocks.lt.mockReturnValue(query); mocks.order.mockReturnValue(query);
  mocks.limit.mockResolvedValue({ data: [{ user_id: "oldest" }, { user_id: "next" }], error: null });
  mocks.admin.mockReturnValue({ from: () => query });
  mocks.lease.mockImplementation(async (_config, id, callback) => callback({ user_id: id }));
  mocks.reconcile.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("bounded autonomous reconciliation", () => {
  it("does no database or provider work when disabled", async () => {
    vi.stubEnv("DATA_API_BILLING_RECONCILE_ENABLED", "false");
    expect(await reconcileDataBilling()).toEqual({ disabled: true });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("checks the oldest due customers, bounded to ten", async () => {
    expect(await reconcileDataBilling()).toEqual({ checked: 2, failed: 0 });
    expect(mocks.limit).toHaveBeenCalledWith(10);
    expect(mocks.order).toHaveBeenCalledWith("last_checked_at");
    expect(mocks.lt).toHaveBeenCalledWith("last_checked_at", expect.any(String));
    expect(mocks.lease.mock.calls.map(([, id]) => id)).toEqual(["oldest", "next"]);
  });
  it("continues after one failure and reports an aggregate retry without user details", async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error("private-customer-detail"));
    await expect(reconcileDataBilling()).rejects.toThrow("(1 failed, 1 checked)");
    expect(mocks.lease).toHaveBeenCalledTimes(2);
  });
  it("fails closed on database lookup failure", async () => {
    mocks.limit.mockResolvedValue({ data: null, error: { message: "private-database-detail" } });
    await expect(reconcileDataBilling()).rejects.toThrow("lookup failed"); expect(mocks.lease).not.toHaveBeenCalled();
  });
  it("stops taking customers after its execution budget", async () => {
    let now = 100_000; vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.reconcile.mockImplementationOnce(async () => { now += 61_000; });
    expect(await reconcileDataBilling()).toEqual({ checked: 1, failed: 0 });
    expect(mocks.lease).toHaveBeenCalledTimes(1);
  });
});

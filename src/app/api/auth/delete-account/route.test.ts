import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "127.0.0.1", rateLimit: async () => ({ success: true }), RATE_LIMITS: { auth: {} }, rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/logging", () => ({ systemLog: { warn: vi.fn() } }));
import { POST } from "./route";
let user: { id: string } | null;
function request(confirmation = "DELETE") {
  return new NextRequest("https://aimarketcap.tech/api/auth/delete-account", {
    method: "POST", headers: { origin: "https://aimarketcap.tech", "content-type": "application/json" }, body: JSON.stringify({ confirmation }),
  });
}
beforeEach(() => {
  vi.clearAllMocks(); user = { id: "billing-owner" };
  mocks.from.mockImplementation((table: string) => {
    if (table !== "wallets") throw new Error("Account deletion must not start before billing approval");
    const query = { select: () => query, eq: () => query, single: async () => ({ data: null, error: null }) };
    return query;
  });
  mocks.client.mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user } }) }, from: mocks.from }));
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: false, error: null });
});
describe("account deletion billing fence", () => {
  it("blocks linked billing before deleting or anonymizing any user data", async () => {
    expect((await POST(request())).status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledWith("prepare_data_api_billing_deletion", { p_user_id: "billing-owner" });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["wallets"]);
  });
  it("fails closed if the billing migration or database is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "RPC unavailable" } });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["wallets"]);
  });
  it("does not create deletion markers for unauthenticated requests", async () => {
    user = null; expect((await POST(request())).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires explicit deletion confirmation before checking billing", async () => {
    expect((await POST(request("NO"))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

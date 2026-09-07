import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ client: vi.fn(), portal: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "127.0.0.1", rateLimit: mocks.rate, RATE_LIMITS: { auth: {} } }));
vi.mock("@/lib/data-api/billing/checkout", () => ({ createDataPortal: mocks.portal }));
vi.mock("@/lib/data-api/billing/config", () => ({ getDataBillingConfig: () => ({}) }));
vi.mock("@/lib/api-error", async (original) => {
  const actual = await original<typeof import("@/lib/api-error")>();
  return { ApiError: actual.ApiError, handleApiError: (e: { statusCode?: number; message: string }) => Response.json({ error: e.message }, { status: e.statusCode ?? 500 }) };
});
import { POST } from "./route";
let user: { id: string; email_confirmed_at?: string } | null;
let banned: boolean;
function request(origin = "https://aimarketcap.tech") {
  return new NextRequest("https://aimarketcap.tech/api/data-access/portal", { method: "POST", headers: { origin }, body: JSON.stringify({ customer: "cus_foreign", userId: "foreign" }) });
}
beforeEach(() => {
  vi.clearAllMocks(); user = { id: "billing-owner", email_confirmed_at: "2026-01-01T00:00:00Z" }; banned = false;
  mocks.rate.mockResolvedValue({ success: true });
  mocks.portal.mockResolvedValue("https://billing.stripe.com/p/session/fixture");
  mocks.client.mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_banned: banned }, error: null }) }) }) }),
  }));
});
describe("owned billing management", () => {
  it("uses only the authenticated owner, not customer IDs from the request", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.portal).toHaveBeenCalledWith({}, "billing-owner");
  });
  it("requires login", async () => { user = null; expect((await POST(request())).status).toBe(401); expect(mocks.portal).not.toHaveBeenCalled(); });
  it("rejects cross-origin requests", async () => { expect((await POST(request("https://evil.example"))).status).toBe(403); expect(mocks.portal).not.toHaveBeenCalled(); });
  it("enforces rate limits", async () => { mocks.rate.mockResolvedValue({ success: false }); expect((await POST(request())).status).toBe(429); expect(mocks.portal).not.toHaveBeenCalled(); });
  it("retains cancellation for banned owners", async () => { banned = true; expect((await POST(request())).status).toBe(200); });
  it("retains cancellation while an owner verifies a changed email", async () => { user = { id: "billing-owner" }; expect((await POST(request())).status).toBe(200); });
  it("does not depend on the new-sales flag", async () => {
    vi.stubEnv("DATA_API_BILLING_ENABLED", "false");
    try { expect((await POST(request())).status).toBe(200); } finally { vi.unstubAllEnvs(); }
  });
});

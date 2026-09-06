import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ client: vi.fn(), checkout: vi.fn(), rate: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "127.0.0.1", rateLimit: mocks.rate, RATE_LIMITS: { auth: {} } }));
vi.mock("@/lib/data-api/billing/checkout", () => ({ createDataCheckout: mocks.checkout }));
vi.mock("@/lib/data-api/billing/config", () => ({ dataBillingCheckoutEnabled: mocks.enabled, getDataBillingConfig: () => ({}) }));
vi.mock("@/lib/api-error", async (original) => {
  const actual = await original<typeof import("@/lib/api-error")>();
  return { ApiError: actual.ApiError, handleApiError: (e: { statusCode?: number; message: string }) => Response.json({ error: e.message }, { status: e.statusCode ?? 500 }) };
});
import { POST } from "./route";
let user: { id: string; email_confirmed_at?: string } | null;
let banned: boolean;
function request(body: unknown = { plan: "pro" }, origin = "https://aimarketcap.tech") {
  return new NextRequest("https://aimarketcap.tech/api/data-access/checkout", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); user = { id: "verified-user", email_confirmed_at: "2026-01-01T00:00:00Z" }; banned = false;
  mocks.rate.mockResolvedValue({ success: true }); mocks.enabled.mockReturnValue(true);
  mocks.checkout.mockResolvedValue("https://checkout.stripe.com/c/pay/test");
  mocks.client.mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_banned: banned }, error: null }) }) }) }),
  }));
});
describe("authenticated subscription checkout route", () => {
  it("requires login", async () => { user = null; expect((await POST(request())).status).toBe(401); expect(mocks.checkout).not.toHaveBeenCalled(); });
  it("requires verified email", async () => { user = { id: "unverified" }; expect((await POST(request())).status).toBe(403); });
  it("rejects banned profiles", async () => { banned = true; expect((await POST(request())).status).toBe(403); });
  it("rejects cross-origin requests", async () => { expect((await POST(request({}, "https://evil.example"))).status).toBe(403); expect(mocks.client).not.toHaveBeenCalled(); });
  it("honors the independent disabled flag", async () => { mocks.enabled.mockReturnValue(false); expect((await POST(request())).status).toBe(503); expect(mocks.checkout).not.toHaveBeenCalled(); });
  it("does not accept user-controlled customer, owner, return URL or price IDs", async () => {
    for (const extra of [{ customer: "cus_foreign" }, { userId: "foreign" }, { price: "price_cheap" }, { return_url: "https://evil.example" }]) {
      expect((await POST(request({ plan: "pro", ...extra }))).status).toBe(400);
    }
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("uses the authenticated identity", async () => { expect((await POST(request())).status).toBe(200); expect(mocks.checkout).toHaveBeenCalledWith({}, user, "pro"); });
  it("enforces rate limits", async () => { mocks.rate.mockResolvedValue({ success: false }); expect((await POST(request())).status).toBe(429); });
  it("rejects oversized bodies", async () => { expect((await POST(request({ plan: "x".repeat(2050) }))).status).toBe(413); });
});

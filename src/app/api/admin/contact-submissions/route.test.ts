import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { api: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

describe("GET /api/admin/contact-submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent marketplace inquiries for admins with normalized listing context", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { is_admin: true },
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "contact_submissions") {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "sub-1",
                      name: "Buyer",
                      email: "buyer@example.com",
                      category: "listing",
                      subject: "Marketplace inquiry for Agent Protocol Kit",
                      message: "Can you share onboarding details?",
                      created_at: "2026-03-20T12:00:00.000Z",
                      metadata: {
                        listing_id: "listing-1",
                        listing_slug: "agent-protocol-kit",
                        listing_title: "Agent Protocol Kit",
                        seller_id: "seller-1",
                      },
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/admin/contact-submissions?limit=5")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: "sub-1",
        listingSlug: "agent-protocol-kit",
        listingTitle: "Agent Protocol Kit",
        sellerId: "seller-1",
        link: "/marketplace/agent-protocol-kit",
      }),
    ]);
  });

  it("rejects non-admin users", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { is_admin: false },
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/admin/contact-submissions")
    );

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/admin/contact-submissions", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const request = (body: unknown = { id, status: "replied" }, origin = "https://aimarketcap.tech") =>
    new NextRequest("https://aimarketcap.tech/api/admin/contact-submissions", {
      method: "PATCH", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body),
    });
  function session(profile = { is_admin: true, is_banned: false }, loggedIn = true) {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: loggedIn ? { id: "admin" } : null } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }) }),
    } as never);
  }
  beforeEach(() => { vi.clearAllMocks(); session(); });

  it("rejects cross-origin changes before database access", async () => {
    expect((await PATCH(request({ id, status: "read" }, "https://evil.example"))).status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
  it("requires an authenticated, non-banned administrator", async () => {
    session({ is_admin: true, is_banned: false }, false);
    expect((await PATCH(request())).status).toBe(401);
    session({ is_admin: false, is_banned: false });
    expect((await PATCH(request())).status).toBe(403);
    session({ is_admin: true, is_banned: true });
    expect((await PATCH(request())).status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
  it("rejects malformed identifiers and unsupported status values", async () => {
    expect((await PATCH(request({ id: "bad", status: "read" }))).status).toBe(400);
    expect((await PATCH(request({ id, status: "paid" }))).status).toBe(400);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
  it("updates exactly the requested enquiry without granting access or sending mail", async () => {
    const eq = vi.fn(() => ({ select: () => ({ maybeSingle: async () => ({ data: { id, status: "replied" }, error: null }) }) }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    mockCreateAdminClient.mockReturnValue({ from } as never);
    const response = await PATCH(request());
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledExactlyOnceWith("contact_submissions");
    expect(eq).toHaveBeenCalledWith("id", id);
    // Older production tables lack updated_at; status changes must not depend on it.
    expect(update).toHaveBeenCalledExactlyOnceWith({ status: "replied" });
  });
});

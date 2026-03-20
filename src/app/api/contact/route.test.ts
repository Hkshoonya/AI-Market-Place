import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("https://aimarketcap.tech/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Vitest Contact",
    },
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a generic contact submission without notifying admin users", async () => {
    const contactInsert = vi.fn().mockResolvedValue({ error: null });
    const notificationsInsert = vi.fn().mockResolvedValue({ error: null });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "contact_submissions") {
          return { insert: contactInsert };
        }
        if (table === "notifications") {
          return { insert: notificationsInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      makeRequest({
        name: "Harshit",
        email: "harshit@example.com",
        category: "general",
        subject: "General question",
        message: "Need help with the marketplace.",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(contactInsert).toHaveBeenCalledOnce();
    expect(notificationsInsert).not.toHaveBeenCalled();
  });

  it("notifies the targeted seller when a listing contact submission includes seller context", async () => {
    const contactInsert = vi.fn().mockResolvedValue({ error: null });
    const notificationsInsert = vi.fn().mockResolvedValue({ error: null });
    const listingSingle = vi.fn().mockResolvedValue({
      data: {
        id: "listing-1",
        seller_id: "seller-1",
        title: "Agent Protocol Kit",
        slug: "agent-protocol-kit",
      },
      error: null,
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "contact_submissions") {
          return { insert: contactInsert };
        }
        if (table === "marketplace_listings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: listingSingle,
              })),
            })),
          };
        }
        if (table === "notifications") {
          return { insert: notificationsInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      makeRequest({
        name: "Buyer",
        email: "buyer@example.com",
        category: "listing",
        subject: "Interested in your listing",
        message: "Can you share onboarding details?",
        listing_id: "listing-1",
        seller_id: "seller-1",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(contactInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Interested in your listing",
        metadata: expect.objectContaining({
          listing_id: "listing-1",
          seller_id: "seller-1",
        }),
      })
    );
    expect(notificationsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "seller-1",
        type: "marketplace",
        title: "New marketplace inquiry",
        link: "/marketplace/agent-protocol-kit",
      })
    );
  });
});

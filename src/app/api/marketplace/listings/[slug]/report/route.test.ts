import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

const mockCreateClient = vi.mocked(createClient);

function makeClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });

  return {
    insert,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from: vi.fn((table: string) => {
      if (table === "marketplace_listings") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "listing-1" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "listing_reports") {
        return {
          insert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("POST /api/marketplace/listings/[slug]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a report for same-origin signed-in requests", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/test/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ reason: "spam", details: "bad listing" }),
      }),
      { params: Promise.resolve({ slug: "test" }) }
    );

    expect(response.status).toBe(201);
    expect(client.insert).toHaveBeenCalled();
  });

  it("rejects cross-origin listing reports", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/test/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ reason: "spam" }),
      }),
      { params: Promise.resolve({ slug: "test" }) }
    );

    expect(response.status).toBe(403);
  });
});

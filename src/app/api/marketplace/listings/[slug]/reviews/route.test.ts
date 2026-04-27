import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { public: {}, api: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: vi.fn((response: { data: unknown[] | null }) => response.data ?? []),
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

function makeServerClient() {
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: "review-1", rating: 5, title: "Great", content: "Useful" },
    error: null,
  });

  return {
    insertSingle,
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

      if (table === "marketplace_reviews") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: insertSingle,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("POST /api/marketplace/listings/[slug]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a review for same-origin signed-in requests", async () => {
    const client = makeServerClient();
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/test/reviews", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          rating: 5,
          title: "Great",
          content: "Useful",
        }),
      }),
      { params: Promise.resolve({ slug: "test" }) }
    );

    expect(response.status).toBe(201);
    expect(client.insertSingle).toHaveBeenCalled();
  });

  it("rejects cross-origin review submissions", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/test/reviews", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          rating: 5,
        }),
      }),
      { params: Promise.resolve({ slug: "test" }) }
    );

    expect(response.status).toBe(403);
  });
});

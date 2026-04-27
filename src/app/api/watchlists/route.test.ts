import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { public: {}, write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("POST /api/watchlists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a watchlist for a same-origin signed-in request", async () => {
    const insertSingle = vi.fn(async () => ({
      data: { id: "watchlist-1", name: "Favorites" },
      error: null,
    }));

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "watchlists") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: insertSingle,
            })),
          })),
        };
      }),
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/watchlists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          name: "Favorites",
          is_public: true,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insertSingle).toHaveBeenCalled();
  });

  it("rejects cross-origin watchlist creation", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/watchlists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ name: "Favorites" }),
      })
    );

    expect(response.status).toBe(403);
  });
});

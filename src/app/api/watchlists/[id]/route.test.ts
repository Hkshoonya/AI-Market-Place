import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { api: {}, public: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResultSingle: vi.fn((response: { data: unknown }) => response.data),
}));

import { createClient } from "@/lib/supabase/server";
import { DELETE, PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("/api/watchlists/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a watchlist for a same-origin owner request", async () => {
    const updateSingle = vi.fn(async () => ({
      data: { id: "watchlist-1", name: "Updated" },
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
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: updateSingle,
                })),
              })),
            })),
          })),
        };
      }),
    } as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/watchlists/watchlist-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "watchlist-1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateSingle).toHaveBeenCalled();
  });

  it("rejects cross-origin watchlist deletions", async () => {
    const deleteEq = vi.fn();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "watchlists") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: deleteEq,
            })),
          })),
        };
      }),
    } as never);

    const response = await DELETE(
      new NextRequest("https://aimarketcap.tech/api/watchlists/watchlist-1", {
        method: "DELETE",
        headers: {
          origin: "https://evil.example",
        },
      }),
      { params: Promise.resolve({ id: "watchlist-1" }) }
    );

    expect(response.status).toBe(403);
    expect(deleteEq).not.toHaveBeenCalled();
  });
});

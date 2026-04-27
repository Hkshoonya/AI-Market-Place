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

import { createClient } from "@/lib/supabase/server";
import { DELETE, POST } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("/api/watchlists/[id]/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a model to a watchlist for a same-origin owner request", async () => {
    const watchlistsUpdateEq = vi.fn(async () => ({ error: null }));
    const insertSingle = vi.fn(async () => ({
      data: { id: "item-1", model_id: "model-1" },
      error: null,
    }));

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "watchlists") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: "watchlist-1" }, error: null })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: watchlistsUpdateEq,
            })),
          };
        }

        if (table === "watchlist_items") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: insertSingle,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/watchlists/watchlist-1/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ model_id: "model-1" }),
      }),
      { params: Promise.resolve({ id: "watchlist-1" }) }
    );

    expect(response.status).toBe(201);
    expect(insertSingle).toHaveBeenCalled();
    expect(watchlistsUpdateEq).toHaveBeenCalledWith("id", "watchlist-1");
  });

  it("rejects cross-origin watchlist item removals", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    } as never);

    const response = await DELETE(
      new NextRequest(
        "https://aimarketcap.tech/api/watchlists/watchlist-1/items?model_id=model-1",
        {
          method: "DELETE",
          headers: {
            origin: "https://evil.example",
          },
        }
      ),
      { params: Promise.resolve({ id: "watchlist-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

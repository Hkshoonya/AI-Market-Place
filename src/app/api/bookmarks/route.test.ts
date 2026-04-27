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

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { createClient } from "@/lib/supabase/server";
import { DELETE, POST } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("/api/bookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a bookmark for a same-origin signed-in request", async () => {
    const upsertSingle = vi.fn(async () => ({
      data: { id: "bookmark-1", model_id: "550e8400-e29b-41d4-a716-446655440000" },
      error: null,
    }));

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "user_bookmarks") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: upsertSingle,
            })),
          })),
        };
      }),
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/bookmarks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          model_id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(upsertSingle).toHaveBeenCalled();
  });

  it("rejects cross-origin bookmark deletions", async () => {
    const deleteEq = vi.fn();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "user_bookmarks") {
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
      new NextRequest(
        "https://aimarketcap.tech/api/bookmarks?model_id=550e8400-e29b-41d4-a716-446655440000",
        {
          method: "DELETE",
          headers: {
            origin: "https://evil.example",
          },
        }
      )
    );

    expect(response.status).toBe(403);
    expect(deleteEq).not.toHaveBeenCalled();
  });
});

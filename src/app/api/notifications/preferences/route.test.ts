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
import { PUT } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("PUT /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates preferences for a same-origin signed-in request", async () => {
    const upsertSingle = vi.fn(async () => ({
      data: { id: "prefs-1", email_newsletter: false },
      error: null,
    }));

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "notification_preferences") {
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

    const response = await PUT(
      new NextRequest("https://aimarketcap.tech/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          email_newsletter: false,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsertSingle).toHaveBeenCalled();
  });

  it("rejects cross-origin preference updates", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    } as never);

    const response = await PUT(
      new NextRequest("https://aimarketcap.tech/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          email_newsletter: false,
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});

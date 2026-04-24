import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: {
    write: { limit: 20, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/moderate", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
  });
}

function makeSessionClient(options: { user: { id: string } | null; isAdmin: boolean }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: options.user } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: options.user ? { is_admin: options.isAdmin } : null,
      }),
    })),
  };
}

describe("PATCH /api/admin/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error when the admin update fails instead of claiming success", async () => {
    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "admin-1" },
        isAdmin: true,
      }) as never
    );

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                error: { message: "write failed" },
              }),
            })),
          };
        }

        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    } as never);

    const response = await PATCH(
      makeRequest({
        action: "ban",
        target_type: "user",
        target_id: "11111111-1111-1111-1111-111111111111",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("write failed");
  });

  it("rejects cross-origin admin moderation requests", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/moderate", {
        method: "PATCH",
        body: JSON.stringify({
          action: "ban",
          target_type: "user",
          target_id: "11111111-1111-1111-1111-111111111111",
        }),
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
      })
    );

    expect(response.status).toBe(403);
  });
});

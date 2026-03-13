import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockGenerateApiKey = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/agents/auth", () => ({
  generateApiKey: (...args: unknown[]) => mockGenerateApiKey(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 10, remaining: 9, reset: 60 })),
  RATE_LIMITS: { auth: { limit: 10, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
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

import { POST } from "./route";

function createMockSupabase(insertedRows: Record<string, unknown>[]) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: (table: string) => {
      if (table === "api_keys") {
        return {
          select: (...args: unknown[]) => {
            const options = args[1] as { count?: string; head?: boolean } | undefined;
            if (options?.head) {
              return {
                eq: () => ({
                  eq: () => Promise.resolve({ count: 0, error: null }),
                }),
              };
            }

            return {
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            };
          },
          insert: (payload: Record<string, unknown>) => {
            insertedRows.push(payload);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "key-1",
                      name: payload.name,
                      key_prefix: payload.key_prefix,
                      scopes: payload.scopes,
                      rate_limit_per_minute: payload.rate_limit_per_minute,
                      expires_at: payload.expires_at,
                      created_at: "2026-03-13T00:00:00.000Z",
                    },
                    error: null,
                  }),
              }),
            };
          },
        };
      }

      return {};
    },
  };
}

describe("POST /api/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateApiKey.mockReturnValue({
      plaintext: "aimk_plaintext",
      hash: "hashed-key",
      prefix: "aimk_test",
    });
  });

  it("accepts the withdraw scope when creating API keys", async () => {
    const insertedRows: Record<string, unknown>[] = [];
    mockCreateClient.mockResolvedValue(createMockSupabase(insertedRows));

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Withdraw Bot",
          scopes: ["read", "withdraw"],
          expires_in_days: 30,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(insertedRows[0]?.scopes).toEqual(["read", "withdraw"]);
    expect(body.key.scopes).toEqual(["read", "withdraw"]);
    expect(body.plaintext_key).toBe("aimk_plaintext");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockHandleMcpRequest = vi.fn();
const mockExtractApiKey = vi.fn();
const mockValidateApiKey = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/mcp/server", () => ({
  handleMcpRequest: (...args: unknown[]) => mockHandleMcpRequest(...args),
}));

vi.mock("@/lib/agents/auth", () => ({
  extractApiKey: (...args: unknown[]) => mockExtractApiKey(...args),
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: { api: { limit: 20, windowMs: 60_000 } },
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

describe("POST /api/mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    mockCreateClient.mockImplementation((_url: string, key: string) => ({
      key,
    }));

    mockHandleMcpRequest.mockResolvedValue({
      jsonrpc: "2.0",
      id: 1,
      result: { ok: true },
    });
  });

  it("uses the public anon client for unauthenticated read requests", async () => {
    mockExtractApiKey.mockReturnValue(null);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "get_model",
            arguments: { slug: "gpt-5.5" },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key"
    );
    expect(mockHandleMcpRequest).toHaveBeenCalledWith(
      { key: "anon-key" },
      expect.objectContaining({ method: "tools/call" }),
      undefined
    );
  });

  it("uses the privileged service client for authenticated write tools", async () => {
    mockExtractApiKey.mockReturnValue("aimk_valid");
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      keyRecord: {
        id: "key-1",
        owner_id: "user-1",
        scopes: ["marketplace"],
      },
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer aimk_valid",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "purchase",
            arguments: { listing_id: "listing-1" },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockHandleMcpRequest).toHaveBeenCalledWith(
      { key: "service-key" },
      expect.objectContaining({ method: "tools/call" }),
      expect.objectContaining({ owner_id: "user-1" })
    );
  });
});

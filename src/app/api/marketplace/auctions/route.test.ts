import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { public: {} },
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: vi.fn((response) => response.data ?? []),
}));

vi.mock("@/lib/marketplace/auctions/dutch", () => ({
  calculateDutchPrice: vi.fn().mockReturnValue(10),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error) => {
    throw error;
  }),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("GET /api/marketplace/auctions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("maps the legacy settled filter to ended before querying Supabase", async () => {
    const inMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockReturnThis();
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

    mockCreateClient.mockReturnValue({
      from: (table: string) => {
        expect(table).toBe("auctions");
        return {
          select: () => ({
            in: inMock,
            eq: eqMock,
            order: orderMock,
            range: rangeMock,
          }),
        };
      },
    } as never);

    const response = await GET(
      new NextRequest("https://example.com/api/marketplace/auctions?status=settled")
    );
    const body = await response.json();

    expect(inMock).toHaveBeenCalledWith("status", ["ended"]);
    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

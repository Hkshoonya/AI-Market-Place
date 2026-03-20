import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: vi.fn(),
}));

vi.mock("@/lib/marketplace/auctions/english", () => ({
  placeBid: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { placeBid } from "@/lib/marketplace/auctions/english";
import { POST } from "./route";

describe("POST /api/marketplace/auctions/[id]/bid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid bid payloads before auction execution", async () => {
    vi.mocked(resolveAuthUser).mockResolvedValue({
      userId: "buyer-1",
      authMethod: "session",
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/auctions/auction-1/bid", {
        method: "POST",
        body: JSON.stringify({ amount: -5 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "auction-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(vi.mocked(placeBid)).not.toHaveBeenCalled();
  });

  it("maps insufficient funds bid failures to HTTP 402", async () => {
    vi.mocked(resolveAuthUser).mockResolvedValue({
      userId: "buyer-1",
      authMethod: "session",
    } as never);
    vi.mocked(placeBid).mockResolvedValue({
      success: false,
      error: "Insufficient available balance to place bid.",
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/auctions/auction-1/bid", {
        method: "POST",
        body: JSON.stringify({ amount: 125 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "auction-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error).toMatch(/insufficient/i);
  });
});

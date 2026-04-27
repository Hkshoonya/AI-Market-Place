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

vi.mock("@/lib/marketplace/auctions/dutch", () => ({
  acceptDutchAuction: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { acceptDutchAuction } from "@/lib/marketplace/auctions/dutch";
import { POST } from "./route";

describe("POST /api/marketplace/auctions/[id]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication before accepting a Dutch auction", async () => {
    vi.mocked(resolveAuthUser).mockResolvedValue(null);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/auctions/auction-1/accept", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      }),
      { params: Promise.resolve({ id: "auction-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/authentication required/i);
  });

  it("maps sold-race conflicts to HTTP 409", async () => {
    vi.mocked(resolveAuthUser).mockResolvedValue({
      userId: "buyer-1",
      authMethod: "session",
    } as never);
    vi.mocked(acceptDutchAuction).mockResolvedValue({
      success: false,
      error: "Auction was accepted by another buyer moments ago.",
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/auctions/auction-1/accept", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      }),
      { params: Promise.resolve({ id: "auction-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/another buyer/i);
  });

  it("rejects cross-origin browser auction accepts", async () => {
    vi.mocked(resolveAuthUser).mockResolvedValue({
      userId: "buyer-1",
      authMethod: "session",
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/auctions/auction-1/accept", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
      }),
      { params: Promise.resolve({ id: "auction-1" }) }
    );

    expect(response.status).toBe(403);
    expect(vi.mocked(acceptDutchAuction)).not.toHaveBeenCalled();
  });
});

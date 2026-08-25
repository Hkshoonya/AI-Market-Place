import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  systemLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: { api: { limit: 60, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { requireAdminSession } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

const mockRequireAdminSession = vi.mocked(requireAdminSession);
const mockCreateAdminClient = vi.mocked(createAdminClient);

function request() {
  return new NextRequest("http://localhost/api/admin/analytics");
}

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("loads every active model beyond the PostgREST 1,000-row cap", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) => ({
      category: index % 2 === 0 ? "llm" : "image-generation",
      provider: index % 2 === 0 ? "Provider A" : "Provider B",
      is_open_weights: index % 4 === 0,
    }));
    const range = vi.fn((from: number) =>
      Promise.resolve({
        data:
          from === 0
            ? firstPage
            : [{ category: null, provider: "Provider C", is_open_weights: true }],
        count: 1_001,
        error: null,
      })
    );
    const dimensionsBuilder = {
      eq: vi.fn(),
      range,
    };
    dimensionsBuilder.eq.mockReturnValue(dimensionsBuilder);

    const topDownloaded = {
      data: [{ name: "Popular", provider: "Provider A", hf_downloads: 100 }],
      error: null,
    };
    const topRated = {
      data: [{ name: "Rated", provider: "Provider B", quality_score: 99 }],
      error: null,
    };

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn((columns: string) => {
          if (columns === "category, provider, is_open_weights") {
            return dimensionsBuilder;
          }

          if (columns === "name, provider, hf_downloads") {
            return {
              eq: () => ({
                order: () => ({ limit: () => Promise.resolve(topDownloaded) }),
              }),
            };
          }

          return {
            eq: () => ({
              not: () => ({
                order: () => ({ limit: () => Promise.resolve(topRated) }),
              }),
            }),
          };
        }),
      })),
    } as never);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(body.openVsClosed.open + body.openVsClosed.closed).toBe(1_001);
    expect(body.providerBreakdown).toEqual(
      expect.arrayContaining([{ provider: "Provider C", count: 1 }])
    );
  });

  it("rejects a request without an admin session", async () => {
    mockRequireAdminSession.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});

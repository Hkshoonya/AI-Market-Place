import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/constants/site";
import sitemap from "./sitemap";

vi.mock("@/lib/supabase/public-server", () => ({
  createOptionalPublicClient: vi.fn(),
}));

import { createOptionalPublicClient } from "@/lib/supabase/public-server";

const createOptionalPublicClientMock = vi.mocked(createOptionalPublicClient);

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns static routes when the public client is unavailable", async () => {
    createOptionalPublicClientMock.mockReturnValue(null);

    const routes = await sitemap();

    expect(routes.length).toBeGreaterThan(5);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: SITE_URL }),
        expect.objectContaining({ url: `${SITE_URL}/models` }),
        expect.objectContaining({ url: `${SITE_URL}/marketplace` }),
        expect.objectContaining({ url: `${SITE_URL}/commons/actors` }),
        expect.objectContaining({ url: `${SITE_URL}/commons/communities` }),
      ])
    );
  });

  it("falls back to static routes when dynamic queries throw", async () => {
    createOptionalPublicClientMock.mockReturnValue({
      from: () => {
        throw new Error("supabase unavailable");
      },
    } as ReturnType<typeof createOptionalPublicClient>);

    const routes = await sitemap();

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: SITE_URL }),
        expect.objectContaining({ url: `${SITE_URL}/providers` }),
      ])
    );
  });


  it("queries auctions without requesting the invalid settled status", async () => {
    const auctionStatusFilters: string[][] = [];

    createOptionalPublicClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "models") {
          return {
            select: (columns: string) => {
              if (columns === "updated_at") {
                return {
                  eq: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: [{ updated_at: "2026-04-13T00:00:00.000Z" }], error: null }),
                    }),
                  }),
                };
              }

              if (columns === "slug, updated_at") {
                return {
                  eq: () => ({
                    order: () => Promise.resolve({
                      data: [{ slug: "kimi-k2", updated_at: "2026-04-13T00:00:00.000Z" }],
                      error: null,
                    }),
                  }),
                };
              }

              if (columns === "provider") {
                return {
                  eq: () => Promise.resolve({
                    data: [{ provider: "OpenAI" }],
                    error: null,
                  }),
                };
              }

              throw new Error(`Unexpected models select: ${columns}`);
            },
          };
        }

        if (table === "marketplace_listings") {
          return {
            select: (columns: string) => {
              if (columns === "updated_at") {
                return {
                  eq: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: [{ updated_at: "2026-04-13T00:00:00.000Z" }], error: null }),
                    }),
                  }),
                };
              }

              if (columns === "slug, updated_at") {
                return {
                  eq: () => Promise.resolve({
                    data: [{ slug: "listing-1", updated_at: "2026-04-13T00:00:00.000Z" }],
                    error: null,
                  }),
                };
              }

              throw new Error(`Unexpected listings select: ${columns}`);
            },
          };
        }

        if (table === "auctions") {
          return {
            select: (columns: string) => ({
              in: (_column: string, statuses: string[]) => {
                auctionStatusFilters.push(statuses);
                if (columns === "updated_at") {
                  return {
                    order: () => ({
                      limit: () => Promise.resolve({ data: [{ updated_at: "2026-04-13T00:00:00.000Z" }], error: null }),
                    }),
                  };
                }

                if (columns === "id, updated_at, status") {
                  return Promise.resolve({
                    data: [{ id: "auction-1", updated_at: "2026-04-13T00:00:00.000Z", status: "active" }],
                    error: null,
                  });
                }

                throw new Error(`Unexpected auctions select: ${columns}`);
              },
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [{ published_at: "2026-04-13T00:00:00.000Z" }], error: null }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    } as ReturnType<typeof createOptionalPublicClient>);

    const routes = await sitemap();

    expect(auctionStatusFilters).toEqual([
      ["upcoming", "active", "ended", "cancelled"],
      ["upcoming", "active", "ended", "cancelled"],
    ]);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: `${SITE_URL}/marketplace/auctions/auction-1` }),
      ])
    );
  });
});

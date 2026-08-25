import { describe, expect, it } from "vitest";

import {
  fetchAllHomepageActiveModels,
  HOMEPAGE_ACTIVE_MODELS_SELECT,
  selectHomepageActiveModelCandidates,
} from "./fetch-active-models";

function createPagedMockSupabase<T>(
  pages: Array<{ data: T[] | null; error: { message?: string } | null }>
) {
  const ranges: Array<[number, number]> = [];
  let pageIndex = 0;

  return {
    ranges,
    client: {
      from: (table: "models") => {
        expect(table).toBe("models");

        const chain = {
          select: (columns: string) => {
            expect(columns).toBe(HOMEPAGE_ACTIVE_MODELS_SELECT);
            return chain;
          },
          eq: (column: string, value: string) => {
            expect(column).toBe("status");
            expect(value).toBe("active");
            return chain;
          },
          order: (column: string, options: { ascending: boolean }) => {
            expect(column).toBe("id");
            expect(options).toEqual({ ascending: true });
            return chain;
          },
          range: (from: number, to: number) => {
            ranges.push([from, to]);
            const result = pages[pageIndex] ?? { data: [], error: null };
            pageIndex += 1;
            return Promise.resolve(result);
          },
        };

        return chain;
      },
    },
  };
}

describe("fetchAllHomepageActiveModels", () => {
  it("paginates beyond the Supabase 1000-row default", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `model-${index + 1}`,
    }));
    const secondPage = [{ id: "model-1001" }, { id: "model-1002" }];
    const { client, ranges } = createPagedMockSupabase([
      { data: firstPage, error: null },
      { data: secondPage, error: null },
    ]);

    const rows = await fetchAllHomepageActiveModels(client);

    expect(rows).toHaveLength(1002);
    expect(rows.at(0)).toEqual({ id: "model-1" });
    expect(rows.at(-1)).toEqual({ id: "model-1002" });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("throws when a page query fails", async () => {
    const { client } = createPagedMockSupabase([
      { data: null, error: { message: "db exploded" } },
    ]);

    await expect(fetchAllHomepageActiveModels(client)).rejects.toThrow(
      "Failed to fetch homepage active models: db exploded"
    );
  });
});

describe("selectHomepageActiveModelCandidates", () => {
  it("retains referenced, ranked, and API-accessible models before raw artifacts", () => {
    const models = [
      { id: "raw-a", release_date: "2026-08-20", is_open_weights: true },
      { id: "api-model", is_api_available: true, release_date: "2025-01-01" },
      { id: "raw-b", release_date: "2026-08-21", is_open_weights: true },
      { id: "ranked-model", overall_rank: 4, release_date: "2025-01-01" },
      { id: "news-model", release_date: "2024-01-01" },
    ];

    const selected = selectHomepageActiveModelCandidates(models, 3, {
      preferredIds: ["news-model"],
      now: Date.parse("2026-08-25T00:00:00.000Z"),
    });

    expect(selected.map((model) => model.id)).toEqual([
      "news-model",
      "ranked-model",
      "api-model",
    ]);
    expect(models.map((model) => model.id)).toEqual([
      "raw-a",
      "api-model",
      "raw-b",
      "ranked-model",
      "news-model",
    ]);
  });

  it("returns every model when the catalog is already below the cap", () => {
    const models = [{ id: "one" }, { id: "two" }];

    expect(selectHomepageActiveModelCandidates(models, 2)).toBe(models);
  });
});

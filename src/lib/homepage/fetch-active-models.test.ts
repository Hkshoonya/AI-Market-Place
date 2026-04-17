import { describe, expect, it } from "vitest";

import {
  fetchAllHomepageActiveModels,
  HOMEPAGE_ACTIVE_MODELS_SELECT,
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

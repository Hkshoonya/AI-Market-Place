import { describe, expect, it } from "vitest";
import { selectRotatingSources } from "./rotating-sources";

describe("selectRotatingSources", () => {
  const sources = Array.from({ length: 23 }, (_, i) => ({ id: String(i).padStart(2, "0") }));

  it("keeps recent releases refreshed and eventually visits every older source", () => {
    let cursor: string | null = null;
    const visited = new Set<string>();
    for (let run = 0; run < 6; run++) {
      const result = selectRotatingSources(sources, 5, cursor);
      expect(result.sources).toHaveLength(5);
      expect(result.sources[0].id).toBe("00");
      expect(new Set(result.sources.map((source) => source.id)).size).toBe(5);
      result.sources.forEach((source) => visited.add(source.id));
      cursor = result.nextCursor;
    }
    expect(visited.size).toBe(sources.length);
  });

  it("resumes after a removed cursor and wraps past the end", () => {
    expect(selectRotatingSources(sources, 5, "05x").sources[1].id).toBe("06");
    expect(selectRotatingSources(sources, 5, "99").sources[1].id).toBe("01");
  });

  it("handles single-slot budgets, small catalogs, and invalid budgets", () => {
    expect(selectRotatingSources(sources, 1, "04").sources[0].id).toBe("05");
    expect(selectRotatingSources(sources, 100, null)).toEqual({ sources, nextCursor: null });
    for (const limit of [0, -1, NaN, Infinity]) {
      expect(selectRotatingSources(sources, limit, null).sources).toEqual([]);
    }
  });
});

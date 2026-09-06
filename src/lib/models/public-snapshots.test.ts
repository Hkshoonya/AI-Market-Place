import { beforeEach, describe, expect, it, vi } from "vitest";

const { results, from, select, eq, order, cacheOptions } = vi.hoisted(() => ({
  results: new Map<string, string>(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), cacheOptions: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: string[]) => Promise<unknown>, keys: string[], options: unknown) => {
    cacheOptions(keys, options);
    return async (...args: string[]) => {
      const key = JSON.stringify([keys, args]);
      const cached = results.get(key);
      if (cached) return JSON.parse(cached);
      const serialized = JSON.stringify(await fn(...args));
      results.set(key, serialized);
      return JSON.parse(serialized);
    };
  },
}));
vi.mock("@/lib/supabase/public-server", () => ({ createPublicClient: () => ({ from }) }));

import { getPublicModelSnapshots } from "./public-snapshots";

beforeEach(() => {
  results.clear();
  from.mockReset().mockReturnValue({ select });
  select.mockReset().mockReturnValue({ eq });
  eq.mockReset().mockReturnValue({ order });
  order.mockReset();
});

describe("public model snapshot cache", () => {
  it("caches public history for five minutes with separate entries per model", async () => {
    const history = [{ snapshot_date: "2026-09-06", quality_score: 42, hf_downloads: 10, hf_likes: 1, overall_rank: 5 }];
    order.mockResolvedValueOnce({ data: history, error: null });
    order.mockResolvedValueOnce({ data: [], error: null });
    expect(await getPublicModelSnapshots("model-a")).toEqual(history);
    expect(await getPublicModelSnapshots("model-a")).toEqual(history);
    expect(await getPublicModelSnapshots("model-b")).toEqual([]);
    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledWith("model_snapshots");
    expect(select).toHaveBeenCalledWith("snapshot_date, quality_score, hf_downloads, hf_likes, overall_rank");
    expect(eq.mock.calls).toEqual([["model_id", "model-a"], ["model_id", "model-b"]]);
    expect(order).toHaveBeenCalledWith("snapshot_date", { ascending: true });
    expect(cacheOptions).toHaveBeenCalledWith(["public-model-snapshots-v1"], { revalidate: 300 });
  });

  it("does not cache query failures as missing history", async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
    order.mockResolvedValueOnce({ data: [], error: null });
    await expect(getPublicModelSnapshots("model-a")).rejects.toThrow("Unable to load public model history");
    expect(await getPublicModelSnapshots("model-a")).toEqual([]);
    expect(from).toHaveBeenCalledTimes(2);
  });
});

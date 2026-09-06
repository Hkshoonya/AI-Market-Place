import { describe, expect, it, vi } from "vitest";
import { getRevenueOperations } from "./operations";
import type { TypedSupabaseClient } from "@/types/database";

describe("revenue operations queries", () => {
  function client(fail = false) {
    const queries: Record<string, ReturnType<typeof vi.fn>>[] = [];
    const from = vi.fn(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const name of ["select", "eq", "or", "in", "lt", "gt", "lte", "neq"]) query[name] = vi.fn(() => query);
      query.then = vi.fn((resolve) => resolve({ count: queries.length, error: fail ? { message: "database offline" } : null }));
      queries.push(query);
      return query;
    });
    return { supabase: { from } as unknown as TypedSupabaseClient, queries };
  }
  it("uses bounded counts, campaign windows and only non-Stripe grant expiries", async () => {
    const { supabase, queries } = client();
    await getRevenueOperations(supabase, new Date("2026-09-06T12:00:00Z"));
    expect(queries).toHaveLength(4);
    for (const query of queries) expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(queries[0].or).toHaveBeenCalledWith("ends_at.is.null,ends_at.gt.2026-09-06T12:00:00.000Z");
    expect(queries[2].lt).toHaveBeenCalledWith("created_at", "2026-09-04T12:00:00.000Z");
    expect(queries[3].neq).toHaveBeenCalledWith("source", "stripe");
    expect(queries[3].lte).toHaveBeenCalledWith("current_period_end", "2026-09-13T12:00:00.000Z");
  });
  it("does not turn database failures into reassuring zero counts", async () => {
    await expect(getRevenueOperations(client(true).supabase)).rejects.toThrow("Revenue monitoring unavailable");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { getStaleSourceCount } from "./pipeline-health";

const NOW = new Date("2026-03-16T20:00:00.000Z").getTime();

function hoursAgo(hours: number) {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
}

describe("getStaleSourceCount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("counts only enabled, non-quarantined stale sources", async () => {
    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "data_sources") {
          return {
            select: () => ({
              eq: () => ({
                is: () =>
                  Promise.resolve({
                    data: [
                      { slug: "fresh-source" },
                      { slug: "stale-source" },
                    ],
                  }),
              }),
            }),
          };
        }

        if (table === "pipeline_health") {
          return {
            select: () =>
              Promise.resolve({
                data: [
                  {
                    source_slug: "fresh-source",
                    last_success_at: hoursAgo(2),
                    expected_interval_hours: 6,
                  },
                  {
                    source_slug: "stale-source",
                    last_success_at: hoursAgo(20),
                    expected_interval_hours: 6,
                  },
                  {
                    source_slug: "quarantined-source",
                    last_success_at: hoursAgo(40),
                    expected_interval_hours: 6,
                  },
                ],
              }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    await expect(getStaleSourceCount()).resolves.toBe(1);
  });

  it("returns zero when there are no active sources", async () => {
    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "data_sources") {
          return {
            select: () => ({
              eq: () => ({
                is: () => Promise.resolve({ data: [] }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    await expect(getStaleSourceCount()).resolves.toBe(0);
  });
});

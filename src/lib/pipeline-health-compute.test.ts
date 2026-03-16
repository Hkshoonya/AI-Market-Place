/**
 * Tests for pipeline-health-compute shared lib
 *
 * Covers:
 * - computeStatus: healthy / degraded / down via failures and staleness
 * - computeStatus: never synced (last_success_at = null) treated as down
 * - mapSyncJobStatus: maps DB status strings to display status strings
 * - HEALTH_PRIORITY: correct priority ordering for client-side sorting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeStatus,
  mapSyncJobStatus,
  HEALTH_PRIORITY,
  resolveEffectiveHealthRow,
} from "./pipeline-health-compute";

// NOW = 2026-03-12T00:00:00Z for deterministic staleness calculations
const NOW = new Date("2026-03-12T00:00:00.000Z").getTime();

function syncedAgo(multiplier: number, intervalHours: number): string {
  return new Date(NOW - multiplier * intervalHours * 60 * 60 * 1000).toISOString();
}

describe("computeStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("failure-based status", () => {
    it("0 failures + recent sync => 'healthy'", () => {
      expect(
        computeStatus({
          consecutive_failures: 0,
          last_success_at: syncedAgo(0.5, 6),
          expected_interval_hours: 6,
        })
      ).toBe("healthy");
    });

    it("1 failure + recent sync => 'healthy'", () => {
      expect(
        computeStatus({
          consecutive_failures: 1,
          last_success_at: syncedAgo(0.5, 6),
          expected_interval_hours: 6,
        })
      ).toBe("healthy");
    });

    it("2 failures + recent sync => 'healthy'", () => {
      expect(
        computeStatus({
          consecutive_failures: 2,
          last_success_at: syncedAgo(0.5, 6),
          expected_interval_hours: 6,
        })
      ).toBe("healthy");
    });

    it("3 failures + recent sync => 'down'", () => {
      expect(
        computeStatus({
          consecutive_failures: 3,
          last_success_at: syncedAgo(0.5, 6),
          expected_interval_hours: 6,
        })
      ).toBe("down");
    });

    it("5 failures => 'down'", () => {
      expect(
        computeStatus({
          consecutive_failures: 5,
          last_success_at: syncedAgo(0.5, 6),
          expected_interval_hours: 6,
        })
      ).toBe("down");
    });
  });

  describe("staleness-based status", () => {
    it("staleness < 2x interval (0 failures) => 'healthy'", () => {
      expect(
        computeStatus({
          consecutive_failures: 0,
          last_success_at: syncedAgo(1.5, 6), // 1.5x interval - within 2x threshold
          expected_interval_hours: 6,
        })
      ).toBe("healthy");
    });

    it("1 failure + sync older than the interval => 'degraded'", () => {
      expect(
        computeStatus({
          consecutive_failures: 1,
          last_success_at: syncedAgo(1.5, 6),
          expected_interval_hours: 6,
        })
      ).toBe("degraded");
    });

    it("staleness > 2x interval but < 4x (0 failures) => 'degraded'", () => {
      expect(
        computeStatus({
          consecutive_failures: 0,
          last_success_at: syncedAgo(2.5, 6), // 2.5x interval - between 2x and 4x
          expected_interval_hours: 6,
        })
      ).toBe("degraded");
    });

    it("staleness > 4x interval (0 failures) => 'down'", () => {
      expect(
        computeStatus({
          consecutive_failures: 0,
          last_success_at: syncedAgo(4.5, 6), // 4.5x interval - beyond 4x threshold
          expected_interval_hours: 6,
        })
      ).toBe("down");
    });
  });

  describe("never synced (last_success_at = null)", () => {
    it("null last_success_at => staleness is Infinity => 'down'", () => {
      expect(
        computeStatus({
          consecutive_failures: 0,
          last_success_at: null,
          expected_interval_hours: 6,
        })
      ).toBe("down");
    });
  });
});

describe("mapSyncJobStatus", () => {
  it("maps 'completed' to 'success'", () => {
    expect(mapSyncJobStatus("completed")).toBe("success");
  });

  it("maps 'failed' to 'failed'", () => {
    expect(mapSyncJobStatus("failed")).toBe("failed");
  });

  it("maps 'running' to 'running'", () => {
    expect(mapSyncJobStatus("running")).toBe("running");
  });

  it("maps unknown status to 'unknown'", () => {
    expect(mapSyncJobStatus("pending")).toBe("unknown");
  });
});

describe("HEALTH_PRIORITY", () => {
  it("down has lowest priority (0)", () => {
    expect(HEALTH_PRIORITY.down).toBe(0);
  });

  it("degraded has middle priority (1)", () => {
    expect(HEALTH_PRIORITY.degraded).toBe(1);
  });

  it("healthy has highest priority (2)", () => {
    expect(HEALTH_PRIORITY.healthy).toBe(2);
  });

  it("sorting by HEALTH_PRIORITY puts down before degraded before healthy", () => {
    const statuses: Array<"healthy" | "degraded" | "down"> = [
      "healthy",
      "down",
      "degraded",
      "healthy",
      "down",
    ];
    const sorted = [...statuses].sort(
      (a, b) => HEALTH_PRIORITY[a] - HEALTH_PRIORITY[b]
    );
    expect(sorted).toEqual(["down", "down", "degraded", "healthy", "healthy"]);
  });
});

describe("resolveEffectiveHealthRow", () => {
  it("prefers the canonical source interval when pipeline_health is stale and lower", () => {
    expect(
      resolveEffectiveHealthRow(
        {
          sync_interval_hours: 168,
          last_success_at: "2026-03-13T00:00:00.000Z",
        },
        {
          expected_interval_hours: 6,
          consecutive_failures: 0,
          last_success_at: "2026-03-13T00:00:00.000Z",
        }
      )
    ).toEqual(
      expect.objectContaining({
        expected_interval_hours: 168,
      })
    );
  });

  it("falls back to the row interval when the source snapshot has no interval", () => {
    expect(
      resolveEffectiveHealthRow(
        {
          sync_interval_hours: null,
          last_success_at: "2026-03-13T00:00:00.000Z",
        },
        {
          expected_interval_hours: 24,
          consecutive_failures: 0,
          last_success_at: "2026-03-13T00:00:00.000Z",
        }
      )
    ).toEqual(
      expect.objectContaining({
        expected_interval_hours: 24,
      })
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchServiceStatus, parseServiceStatus, SERVICE_STATUS_URL } from "./service-status";

afterEach(() => vi.unstubAllGlobals());

describe("public service status", () => {
  const now = Date.parse("2026-11-06T15:00:00Z");
  it("only confirms an interruption from fresh repeated readiness failures", () => {
    expect(parseServiceStatus({ health: "degraded", checkedAt: now, consecutiveFailures: 2 }, now).state).toBe("interrupted");
    expect(parseServiceStatus({ health: "down", checkedAt: now, consecutiveFailures: 1 }, now).state).toBe("unknown");
    expect(parseServiceStatus({ health: "up", checkedAt: now, consecutiveFailures: 0 }, now).state).toBe("operational");
  });
  it("does not turn stale, malformed, paused or pipeline-only status into maintenance", () => {
    for (const raw of [null, {}, { status: "degraded" }, { health: "paused", checkedAt: now },
      { health: "down", checkedAt: now - 181_000, consecutiveFailures: 9 },
      { health: "down", checkedAt: now + 61_000, consecutiveFailures: 9 }]) {
      expect(parseServiceStatus(raw, now).state).toBe("unknown");
    }
  });
  it("reads the fixed independent endpoint without sending cookies", async () => {
    const network = vi.fn<typeof fetch>(async () => Response.json({ health: "up", checkedAt: Date.now() }));
    vi.stubGlobal("fetch", network);
    expect((await fetchServiceStatus()).state).toBe("operational");
    expect(network).toHaveBeenCalledWith(SERVICE_STATUS_URL, expect.objectContaining({ credentials: "omit", redirect: "error" }));
  });
  it("treats monitor transport failure as unknown, not a confirmed site outage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network unavailable"); }));
    expect((await fetchServiceStatus()).state).toBe("unknown");
  });
});

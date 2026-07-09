import { afterEach, describe, expect, it, vi } from "vitest";
import cronDispatcher from "../../cloudflare/cron-dispatcher/src/index";
import {
  dueJobsForTime,
  matchesCronExpression,
} from "../../cloudflare/cron-dispatcher/src/schedule";

describe("cloudflare cron dispatcher schedule", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("matches reachable staggered schedules on the five-minute Worker trigger", () => {
    const atTop = new Date("2026-05-18T04:00:00.000Z");
    const atDeploy = new Date("2026-05-18T04:05:00.000Z");
    const atAuction = new Date("2026-05-18T04:10:00.000Z");
    const atTrending = new Date("2026-05-18T04:20:00.000Z");

    expect(matchesCronExpression("*/10 * * * *", atTop)).toBe(true);
    expect(matchesCronExpression("5-59/15 * * * *", atDeploy)).toBe(true);
    expect(matchesCronExpression("10-59/15 * * * *", atAuction)).toBe(true);
    expect(matchesCronExpression("20-59/30 * * * *", atTrending)).toBe(true);
  });

  it("preserves standard weekday semantics for the weekly UX monitor job", () => {
    const monday = new Date("2026-05-18T10:00:00.000Z");
    const sunday = new Date("2026-05-17T10:00:00.000Z");

    expect(matchesCronExpression("0 10 * * 1", monday)).toBe(true);
    expect(matchesCronExpression("0 10 * * 1", sunday)).toBe(false);
  });

  it("returns the correct job bundle for a high-contention top-of-hour tick", () => {
    const at = new Date("2026-05-18T04:00:00.000Z");
    const dueJobs = dueJobsForTime(at).map((job) => job.name);

    expect(dueJobs).toEqual(
      expect.arrayContaining([
        "Tier 1 Sync",
        "Tier 2 Sync",
        "Launch Signals (X Announcements)",
        "Wallet Chain Deposit Scan",
      ])
    );
    expect(dueJobs).not.toContain("Auction Settlement");
    expect(dueJobs).not.toContain("Deployment Reconcile");
    expect(dueJobs).not.toContain("Launch Signals (Provider News)");
  });

  it("staggered launch-signal syncs land on separate five-minute ticks", () => {
    const onHour = new Date("2026-05-18T05:00:00.000Z");
    const atFive = new Date("2026-05-18T05:05:00.000Z");

    expect(dueJobsForTime(onHour).map((job) => job.name)).toEqual(
      expect.arrayContaining(["Launch Signals (X Announcements)"])
    );
    expect(dueJobsForTime(onHour).map((job) => job.name)).not.toContain(
      "Launch Signals (Provider News)"
    );

    expect(dueJobsForTime(atFive).map((job) => job.name)).toEqual(
      expect.arrayContaining([
        "Launch Signals (Provider News)",
        "Deployment Reconcile",
      ])
    );
    expect(dueJobsForTime(atFive).map((job) => job.name)).not.toContain(
      "Auction Settlement"
    );
  });

  it("scores new models shortly after the even-hour sync window", () => {
    const afterEvenHourSync = new Date("2026-05-18T04:25:00.000Z");
    const verifierTime = new Date("2026-05-18T04:15:00.000Z");
    const formerScoreTime = new Date("2026-05-18T04:45:00.000Z");
    const oddHour = new Date("2026-05-18T05:25:00.000Z");

    expect(dueJobsForTime(afterEvenHourSync).map((job) => job.name)).toContain(
      "Compute Scores"
    );
    expect(dueJobsForTime(verifierTime).map((job) => job.name)).not.toContain(
      "Compute Scores"
    );
    expect(dueJobsForTime(formerScoreTime).map((job) => job.name)).not.toContain(
      "Compute Scores"
    );
    expect(dueJobsForTime(oddHour).map((job) => job.name)).not.toContain(
      "Compute Scores"
    );
  });

  it("submits due jobs through the authenticated background dispatcher", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "healthy",
          cron: { mode: "external" },
          release: { commitSha: "test-sha" },
        })
      )
      .mockResolvedValue(
        Response.json({ accepted: true }, { status: 202 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const waitUntil = vi.fn();
    const scheduledTime = new Date("2026-05-18T04:20:00.000Z").getTime();

    await cronDispatcher.scheduled(
      { cron: "*/5 * * * *", scheduledTime },
      {
        CRON_SECRET: "test-secret",
        TARGET_BASE_URL: "https://aimarketcap.tech",
      },
      { waitUntil }
    );

    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0]?.[0];

    const dispatchCalls = fetchMock.mock.calls.slice(1);
    expect(dispatchCalls.length).toBeGreaterThan(0);
    for (const [url, init] of dispatchCalls) {
      expect(url).toBe("https://aimarketcap.tech/api/cron/dispatch");
      expect(init).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-secret",
            "Content-Type": "application/json",
          }),
        })
      );
      const body = JSON.parse(String(init?.body));
      expect(body.path).toMatch(/^\/api\//);
      expect(body.scheduledTime).toBe("2026-05-18T04:20:00.000Z");
    }
  });
});

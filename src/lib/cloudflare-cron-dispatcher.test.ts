import { describe, expect, it } from "vitest";
import {
  dueJobsForTime,
  matchesCronExpression,
} from "../../cloudflare/cron-dispatcher/src/schedule";

describe("cloudflare cron dispatcher schedule", () => {
  it("matches every-five-minute and offset-five-minute jobs correctly", () => {
    const atTop = new Date("2026-05-18T04:00:00.000Z");
    const atOffset = new Date("2026-05-18T04:02:00.000Z");

    expect(matchesCronExpression("*/5 * * * *", atTop)).toBe(true);
    expect(matchesCronExpression("2-59/5 * * * *", atTop)).toBe(false);

    expect(matchesCronExpression("*/5 * * * *", atOffset)).toBe(false);
    expect(matchesCronExpression("2-59/5 * * * *", atOffset)).toBe(true);
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
        "Auction Settlement",
        "Deployment Reconcile",
      ])
    );
    expect(dueJobs).not.toContain("Wallet Chain Deposit Scan");
  });
});

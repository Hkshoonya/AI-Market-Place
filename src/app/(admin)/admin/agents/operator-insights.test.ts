import { describe, expect, it } from "vitest";
import {
  describeRunningDuration,
  getIssueVerificationSummary,
} from "./operator-insights";

describe("operator-insights", () => {
  it("formats stuck task duration from started time", () => {
    expect(
      describeRunningDuration(
        "2026-03-20T10:15:00.000Z",
        "2026-03-20T10:00:00.000Z",
        Date.parse("2026-03-20T12:00:00.000Z")
      )
    ).toBe("1h 45m");
  });

  it("falls back to created time when started time is missing", () => {
    expect(
      describeRunningDuration(
        null,
        "2026-03-20T11:42:00.000Z",
        Date.parse("2026-03-20T12:00:00.000Z")
      )
    ).toBe("18m");
  });

  it("extracts operator-facing verification reason and status", () => {
    expect(
      getIssueVerificationSummary({
        status: "auto_disabled",
        reason: "agent exceeded failure threshold during verification",
      })
    ).toEqual({
      status: "auto_disabled",
      reason: "agent exceeded failure threshold during verification",
    });
  });

  it("returns null when no useful verification detail exists", () => {
    expect(getIssueVerificationSummary({})).toBeNull();
    expect(getIssueVerificationSummary(null)).toBeNull();
  });
});

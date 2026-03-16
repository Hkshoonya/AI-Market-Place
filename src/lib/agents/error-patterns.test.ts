import { describe, expect, it } from "vitest";

import {
  matchesAgentErrorPattern,
  normalizeAgentErrorPatternMessage,
} from "./error-patterns";

describe("normalizeAgentErrorPatternMessage", () => {
  it("normalizes timestamps, uuids, and raw numbers", () => {
    expect(
      normalizeAgentErrorPatternMessage(
        "Sync failed for source 42 at 2026-03-16T12:30:45 on job 8f4b1f70-6fd8-4ecb-89ca-8819651d8519"
      )
    ).toBe("Sync failed for source <N> at <TIMESTAMP> on job <UUID>");
  });
});

describe("matchesAgentErrorPattern", () => {
  it("treats differently-numbered instances of the same error as a match", () => {
    expect(
      matchesAgentErrorPattern(
        "Rate limit exceeded after 17 retries for request 93",
        "Rate limit exceeded after 3 retries for request 12"
      )
    ).toBe(true);
  });

  it("matches when the stored pattern is a truncated prefix of the live error", () => {
    expect(
      matchesAgentErrorPattern(
        "Provider outage detected while syncing adapter openrouter-models for tenant 17 in region 4",
        "Provider outage detected while syncing adapter openrouter-models"
      )
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(
      matchesAgentErrorPattern(
        "Supabase insert failed with constraint violation",
        "OpenRouter returned HTTP 503"
      )
    ).toBe(false);
  });
});

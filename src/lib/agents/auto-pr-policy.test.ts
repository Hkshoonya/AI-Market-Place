import { describe, expect, it } from "vitest";

import {
  evaluateAutoPrPolicy,
  extractAutoPrPolicy,
  summarizeAutoPrPolicies,
} from "./auto-pr-policy";

describe("auto-pr policy", () => {
  it("marks safe medium runtime fixes as draft candidates", () => {
    const result = evaluateAutoPrPolicy({
      issueType: "runtime_error_pattern",
      issueTitle: "Fix stale query fallback in leaderboard loader",
      severity: "medium",
      confidence: 0.82,
      occurrenceCount: 4,
      pattern: "TypeError: undefined is not iterable",
      rootCause: "The page assumes a populated query result during pagination fallback.",
      suggestedFix: "Guard the empty array path and reuse the shared paginated loader helper.",
    });

    expect(result).toEqual(
      expect.objectContaining({
        decision: "draft_candidate",
        reasonCode: "draft_runtime_fix",
      })
    );
    expect(result.branchSlug).toContain("agent/code-quality/");
  });

  it("blocks proposals for sensitive auth and payment surfaces", () => {
    const result = evaluateAutoPrPolicy({
      issueType: "runtime_error_pattern",
      issueTitle: "Repair auth session handling in wallet checkout",
      severity: "medium",
      confidence: 0.91,
      occurrenceCount: 3,
      pattern: "Failed to validate session token",
      rootCause: "The auth session refresh collides with payment flow state.",
      suggestedFix: "Rewrite the wallet checkout auth guard.",
    });

    expect(result).toEqual(
      expect.objectContaining({
        decision: "blocked",
        reasonCode: "blocked_sensitive_subsystem",
        branchSlug: null,
      })
    );
  });

  it("keeps high-severity runtime fixes manual-only", () => {
    const result = evaluateAutoPrPolicy({
      issueType: "runtime_error_pattern",
      issueTitle: "Fix repeated provider route crash",
      severity: "high",
      confidence: 0.89,
      occurrenceCount: 6,
      pattern: "Unhandled route error",
      rootCause: "An unchecked null provider response crashes the public route.",
      suggestedFix: "Guard the null path and return the canonical fallback payload.",
    });

    expect(result).toEqual(
      expect.objectContaining({
        decision: "manual_only",
        reasonCode: "manual_high_severity",
      })
    );
    expect(result.proposalTitle).toContain("Draft patch candidate:");
  });

  it("extracts and summarizes stored policy metadata from evidence", () => {
    const issues = [
      {
        evidence: {
          autoPrPolicy: {
            decision: "draft_candidate",
            reasonCode: "draft_runtime_fix",
            summary: "safe",
            proposalTitle: "Draft patch candidate: Fix leaderboard page",
            branchSlug: "agent/code-quality/fix-leaderboard-page",
          },
        },
      },
      {
        evidence: {
          autoPrPolicy: {
            decision: "manual_only",
            reasonCode: "manual_high_severity",
            summary: "manual",
            proposalTitle: "Draft patch candidate: Review provider crash",
            branchSlug: null,
          },
        },
      },
      {
        evidence: {
          autoPrPolicy: {
            decision: "blocked",
            reasonCode: "blocked_sensitive_subsystem",
            summary: "blocked",
            proposalTitle: null,
            branchSlug: null,
          },
        },
      },
    ];

    expect(extractAutoPrPolicy(issues[0].evidence)).toEqual(
      expect.objectContaining({
        decision: "draft_candidate",
        branchSlug: "agent/code-quality/fix-leaderboard-page",
      })
    );

    expect(summarizeAutoPrPolicies(issues)).toEqual({
      draftCandidateCount: 1,
      manualOnlyCount: 1,
      blockedCount: 1,
    });
  });
});

import type { AgentIssueSeverity } from "@/types/database";

export type AutoPrPolicyDecision = "draft_candidate" | "manual_only" | "blocked";

export interface AutoPrPolicyInput {
  issueType: string;
  issueTitle: string;
  severity: AgentIssueSeverity;
  confidence: number;
  occurrenceCount?: number | null;
  pattern?: string | null;
  rootCause?: string | null;
  suggestedFix?: string | null;
}

export interface AutoPrPolicy {
  decision: AutoPrPolicyDecision;
  reasonCode: string;
  summary: string;
  proposalTitle: string | null;
  branchSlug: string | null;
}

export interface AutoPrPolicySummary {
  draftCandidateCount: number;
  manualOnlyCount: number;
  blockedCount: number;
}

const BLOCKED_SUBSYSTEM_KEYWORDS = [
  "auth",
  "oauth",
  "session",
  "password",
  "credential",
  "token",
  "secret",
  "api key",
  "wallet",
  "withdraw",
  "payment",
  "billing",
  "escrow",
  "fee",
  "rls",
  "policy",
  "admin",
  "schema",
  "migration",
  "purchase",
  "marketplace",
];

function makePolicySlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function includesBlockedKeyword(value: string): boolean {
  const normalized = value.toLowerCase();
  return BLOCKED_SUBSYSTEM_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function buildProposalTitle(issueTitle: string): string {
  return `Draft patch candidate: ${issueTitle}`;
}

export function evaluateAutoPrPolicy(input: AutoPrPolicyInput): AutoPrPolicy {
  const rootCause = input.rootCause?.trim() ?? "";
  const suggestedFix = input.suggestedFix?.trim() ?? "";
  const combinedContext = [
    input.issueType,
    input.issueTitle,
    input.pattern ?? "",
    rootCause,
    suggestedFix,
  ].join("\n");

  if (input.issueType !== "runtime_error_pattern") {
    return {
      decision: "blocked",
      reasonCode: "blocked_issue_type",
      summary: "Only repeated runtime error patterns are eligible for patch proposal metadata.",
      proposalTitle: null,
      branchSlug: null,
    };
  }

  if (input.severity === "critical") {
    return {
      decision: "blocked",
      reasonCode: "blocked_critical_severity",
      summary: "Critical issues require direct human ownership instead of draft patch suggestions.",
      proposalTitle: null,
      branchSlug: null,
    };
  }

  if (includesBlockedKeyword(combinedContext)) {
    return {
      decision: "blocked",
      reasonCode: "blocked_sensitive_subsystem",
      summary: "The issue touches a sensitive auth, wallet, policy, or marketplace surface and stays manual-only.",
      proposalTitle: null,
      branchSlug: null,
    };
  }

  if (input.confidence < 0.65) {
    return {
      decision: "blocked",
      reasonCode: "blocked_low_confidence",
      summary: "The analysis confidence is too low to emit even a draft patch proposal.",
      proposalTitle: null,
      branchSlug: null,
    };
  }

  if (!rootCause || !suggestedFix) {
    return {
      decision: "manual_only",
      reasonCode: "manual_incomplete_analysis",
      summary: "The issue is worth operator review, but the model output is missing a complete root cause or fix path.",
      proposalTitle: buildProposalTitle(input.issueTitle),
      branchSlug: null,
    };
  }

  if (input.severity === "high") {
    return {
      decision: "manual_only",
      reasonCode: "manual_high_severity",
      summary: "High-severity issues can carry a proposed fix summary, but they require human review before any patch work begins.",
      proposalTitle: buildProposalTitle(input.issueTitle),
      branchSlug: null,
    };
  }

  if ((input.occurrenceCount ?? 0) >= 25) {
    return {
      decision: "manual_only",
      reasonCode: "manual_broad_blast_radius",
      summary: "The issue affects enough runtime events that an operator should review the blast radius before drafting a patch.",
      proposalTitle: buildProposalTitle(input.issueTitle),
      branchSlug: null,
    };
  }

  if (input.confidence < 0.75) {
    return {
      decision: "manual_only",
      reasonCode: "manual_moderate_confidence",
      summary: "The proposal is directionally useful, but confidence is not high enough for an automatic draft candidate.",
      proposalTitle: buildProposalTitle(input.issueTitle),
      branchSlug: null,
    };
  }

  return {
    decision: "draft_candidate",
    reasonCode: "draft_runtime_fix",
    summary: "This is a bounded runtime issue with a concrete suggested fix and no sensitive subsystem keywords.",
    proposalTitle: buildProposalTitle(input.issueTitle),
    branchSlug: `agent/code-quality/${makePolicySlug(input.issueTitle).slice(0, 48)}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function extractAutoPrPolicy(
  evidence: Record<string, unknown> | null | undefined
): AutoPrPolicy | null {
  const candidate = evidence?.autoPrPolicy;
  if (!isRecord(candidate)) {
    return null;
  }

  const decision = candidate.decision;
  const reasonCode = candidate.reasonCode;
  const summary = candidate.summary;
  const proposalTitle = candidate.proposalTitle;
  const branchSlug = candidate.branchSlug;

  if (
    (decision !== "draft_candidate" &&
      decision !== "manual_only" &&
      decision !== "blocked") ||
    typeof reasonCode !== "string" ||
    typeof summary !== "string"
  ) {
    return null;
  }

  return {
    decision,
    reasonCode,
    summary,
    proposalTitle: typeof proposalTitle === "string" ? proposalTitle : null,
    branchSlug: typeof branchSlug === "string" ? branchSlug : null,
  };
}

export function summarizeAutoPrPolicies(
  issues: Array<{ evidence?: Record<string, unknown> | null }>
): AutoPrPolicySummary {
  return issues.reduce<AutoPrPolicySummary>(
    (summary, issue) => {
      const policy = extractAutoPrPolicy(issue.evidence);
      if (!policy) return summary;

      if (policy.decision === "draft_candidate") {
        summary.draftCandidateCount += 1;
      } else if (policy.decision === "manual_only") {
        summary.manualOnlyCount += 1;
      } else {
        summary.blockedCount += 1;
      }

      return summary;
    },
    {
      draftCandidateCount: 0,
      manualOnlyCount: 0,
      blockedCount: 0,
    }
  );
}

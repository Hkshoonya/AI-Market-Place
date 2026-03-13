import type { TypedSupabaseClient } from "@/types/database";

export type AgentIssueSeverity = "critical" | "high" | "medium" | "low";
export type AgentIssueStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "escalated"
  | "ignored";
export type AgentDeferredRiskLevel = "high" | "medium" | "low";

export interface AgentIssueInput {
  slug: string;
  title: string;
  issueType: string;
  source: string | null;
  severity: AgentIssueSeverity;
  confidence: number;
  detectedBy: string;
  playbook: string | null;
  evidence: Record<string, unknown>;
  verification?: Record<string, unknown> | null;
  status?: AgentIssueStatus;
  retryCount?: number;
}

export interface AgentDeferredItemInput {
  slug: string;
  title: string;
  area: string;
  reason: string;
  riskLevel: AgentDeferredRiskLevel;
  requiredBefore: string | null;
  ownerHint: string | null;
  notes?: Record<string, unknown> | null;
  status?: "open" | "planned" | "done" | "dropped";
}

export async function recordAgentIssue(
  supabase: TypedSupabaseClient,
  issue: AgentIssueInput
): Promise<void> {
  const { error } = await supabase
    .from("agent_issues")
    .upsert(
      {
        slug: issue.slug,
        title: issue.title,
        issue_type: issue.issueType,
        source: issue.source,
        severity: issue.severity,
        status: issue.status ?? "open",
        confidence: issue.confidence,
        detected_by: issue.detectedBy,
        playbook: issue.playbook,
        evidence: issue.evidence,
        verification: issue.verification ?? null,
        retry_count: issue.retryCount ?? 0,
        escalated_at:
          (issue.status ?? "open") === "escalated" ? new Date().toISOString() : null,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to record agent issue: ${error.message}`);
  }
}

export async function resolveAgentIssue(
  supabase: TypedSupabaseClient,
  slug: string,
  verification: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from("agent_issues")
    .update({
      status: "resolved",
      verification,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);

  if (error) {
    throw new Error(`Failed to resolve agent issue: ${error.message}`);
  }
}

export async function recordAgentIssueFailure(
  supabase: TypedSupabaseClient,
  slug: string,
  verification: Record<string, unknown> = {},
  maxRetries = 3
): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from("agent_issues")
    .select("retry_count")
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to load agent issue for retry: ${lookupError.message}`);
  }

  const retryCount = (existing?.retry_count ?? 0) + 1;
  const escalated = retryCount >= maxRetries;
  const { error } = await supabase
    .from("agent_issues")
    .update({
      status: escalated ? "escalated" : "investigating",
      verification,
      retry_count: retryCount,
      escalated_at: escalated ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);

  if (error) {
    throw new Error(`Failed to record agent issue failure: ${error.message}`);
  }
}

export async function recordDeferredItem(
  supabase: TypedSupabaseClient,
  item: AgentDeferredItemInput
): Promise<void> {
  const { error } = await supabase
    .from("agent_deferred_items")
    .upsert(
      {
        slug: item.slug,
        title: item.title,
        area: item.area,
        reason: item.reason,
        risk_level: item.riskLevel,
        required_before: item.requiredBefore,
        owner_hint: item.ownerHint,
        notes: item.notes ?? null,
        status: item.status ?? "open",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to record deferred item: ${error.message}`);
  }
}

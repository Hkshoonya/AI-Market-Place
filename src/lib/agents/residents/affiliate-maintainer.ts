import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { maintainAffiliateLinks } from "@/lib/affiliate/maintenance";
import { recordAgentIssue, resolveAgentIssue } from "../ledger";

const ISSUE_SLUG = "affiliate-link-health-failures";

const affiliateMaintainer: ResidentAgent = {
  slug: "affiliate-maintainer",
  name: "Affiliate Link Maintainer",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const result = await maintainAffiliateLinks({
      supabase: ctx.supabase,
      limit: Number(ctx.agent.config.max_links_per_run ?? 100),
      failureThreshold: Number(ctx.agent.config.failure_threshold ?? 3),
      timeoutMs: Number(ctx.agent.config.request_timeout_ms ?? 8000),
      signal: ctx.signal,
    });

    if (result.invalidated > 0) {
      await recordAgentIssue(ctx.supabase, {
        slug: ISSUE_SLUG,
        title: `${result.invalidated} affiliate link${result.invalidated === 1 ? "" : "s"} auto-invalidated`,
        issueType: "affiliate_link_failure",
        source: "affiliate-maintainer",
        severity: "medium",
        confidence: 0.99,
        detectedBy: "affiliate-maintainer",
        playbook: "review_affiliate_destination_and_reactivate_manually",
        evidence: result,
        verification: {
          status: "repeated_http_failures",
          checkedAt: new Date().toISOString(),
        },
      });
    } else if (result.failed === 0 && result.errors.length === 0) {
      await resolveAgentIssue(ctx.supabase, ISSUE_SLUG, {
        verifier: "affiliate-maintainer",
        reason: "all checked affiliate destinations are healthy",
        checkedAt: new Date().toISOString(),
      });
    }

    await ctx.log.info("Affiliate link maintenance completed", result);
    return {
      success: result.errors.length === 0,
      output: result,
      errors: result.errors,
    };
  },
};

registerAgent(affiliateMaintainer);
export default affiliateMaintainer;

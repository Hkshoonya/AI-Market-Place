import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { listConfiguredAgentProviders } from "@/lib/agents/provider-router";

export const dynamic = "force-dynamic";

function isStaleAgent(lastActiveAt: string | null | undefined, now = Date.now()) {
  if (!lastActiveAt) return true;
  return now - new Date(lastActiveAt).getTime() > 24 * 60 * 60 * 1000;
}

// GET /api/admin/agents — list all agents
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-agents:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [agentsResult, issuesResult, deferredResult] = await Promise.all([
      supabase
        .from("agents")
        .select("*")
        .order("agent_type", { ascending: true })
        .order("name", { ascending: true })
        .limit(100),
      supabase
        .from("agent_issues")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("agent_deferred_items")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    if (agentsResult.error) {
      return NextResponse.json({ error: agentsResult.error.message }, { status: 500 });
    }
    if (issuesResult.error) {
      return NextResponse.json({ error: issuesResult.error.message }, { status: 500 });
    }
    if (deferredResult.error) {
      return NextResponse.json({ error: deferredResult.error.message }, { status: 500 });
    }

    const agents = agentsResult.data ?? [];
    const issues = issuesResult.data ?? [];
    const deferredItems = deferredResult.data ?? [];
    const summary = {
      totalAgents: agents.length,
      activeAgents: agents.filter((agent) => agent.status === "active").length,
      unhealthyAgents: agents.filter(
        (agent) => agent.status !== "active" || Number(agent.error_count ?? 0) > 0
      ).length,
      autoDisabledAgents: agents.filter((agent) => agent.status === "error").length,
      staleAgents: agents.filter((agent) => isStaleAgent(agent.last_active_at)).length,
      openIssues: issues.filter((issue) => issue.status === "open").length,
      escalatedIssues: issues.filter((issue) => issue.status === "escalated").length,
      openDeferredItems: deferredItems.filter((item) => item.status === "open").length,
    };

    return NextResponse.json({
      agents,
      configuredProviders: listConfiguredAgentProviders(),
      issues,
      deferredItems,
      summary,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/agents");
  }
}

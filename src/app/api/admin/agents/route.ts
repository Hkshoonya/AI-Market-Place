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
const STALE_RUNNING_TASK_MINUTES = 30;

function isStaleAgent(lastActiveAt: string | null | undefined, now = Date.now()) {
  if (!lastActiveAt) return true;
  return now - new Date(lastActiveAt).getTime() > 24 * 60 * 60 * 1000;
}

function isAgentCronJob(jobName: string | null | undefined) {
  if (!jobName) return false;
  return jobName.startsWith("agent-") || jobName.startsWith("cron-agents-");
}

function isStaleRunningTask(startedAt: string | null | undefined, now = Date.now()) {
  if (!startedAt) return false;
  return now - new Date(startedAt).getTime() > STALE_RUNNING_TASK_MINUTES * 60 * 1000;
}

type RunningTaskRow = {
  id: string;
  agent_id: string;
  task_type: string;
  status: string;
  started_at: string | null;
  created_at: string;
  agents?: { name: string; slug: string } | null;
};

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

    const [agentsResult, issuesResult, deferredResult, cronRunsResult, runningTasksResult] = await Promise.all([
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
      supabase
        .from("cron_runs")
        .select("id, job_name, status, error_message, started_at, finished_at, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("agent_tasks")
        .select("id, agent_id, task_type, status, started_at, created_at, agents:agent_id(name, slug)")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(20),
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
    if (cronRunsResult.error) {
      return NextResponse.json({ error: cronRunsResult.error.message }, { status: 500 });
    }
    if (runningTasksResult.error) {
      return NextResponse.json({ error: runningTasksResult.error.message }, { status: 500 });
    }

    const agents = agentsResult.data ?? [];
    const issues = issuesResult.data ?? [];
    const deferredItems = deferredResult.data ?? [];
    const recentFailingRuns = (cronRunsResult.data ?? []).filter((run) =>
      isAgentCronJob(run.job_name)
    );
    const runningTasks = (runningTasksResult.data ?? []) as RunningTaskRow[];
    const staleRunningTasks = runningTasks.filter((task) =>
      isStaleRunningTask(task.started_at)
    );
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
      recentFailingRuns: recentFailingRuns.length,
      staleRunningTasks: staleRunningTasks.length,
    };

    return NextResponse.json({
      agents,
      configuredProviders: listConfiguredAgentProviders(),
      issues,
      deferredItems,
      recentFailingRuns,
      staleRunningTasks,
      summary,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/agents");
  }
}

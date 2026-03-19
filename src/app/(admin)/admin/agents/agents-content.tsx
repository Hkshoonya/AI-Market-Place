"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  Save,
} from "lucide-react";
import { SWR_TIERS } from "@/lib/swr/config";
import {
  extractAutoPrPolicy,
  summarizeAutoPrPolicies,
} from "@/lib/agents/auto-pr-policy";
import {
  AGENT_PROVIDER_ORDER,
  type AgentProviderName,
} from "@/lib/agents/provider-model-constants";

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  agent_type: string;
  status: string;
  capabilities: string[];
  total_tasks_completed: number;
  total_conversations: number;
  error_count: number;
  last_active_at: string | null;
}

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  agents?: { name: string; slug: string };
  llm?: { provider: AgentProviderName | null; model: string | null };
}

interface AgentLog {
  id: number;
  agent_id: string;
  level: string;
  message: string;
  created_at: string;
  agents?: { name: string };
}

interface AgentIssue {
  id: string;
  slug: string;
  title: string;
  issue_type: string;
  source: string | null;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  playbook: string | null;
  evidence: Record<string, unknown> | null;
  updated_at: string;
}

interface AgentDeferredItem {
  id: string;
  slug: string;
  title: string;
  area: string;
  reason: string;
  risk_level: "high" | "medium" | "low";
  required_before: string | null;
  owner_hint: string | null;
  status: string;
  updated_at: string;
}

interface AgentCronRun {
  id: string;
  job_name: string;
  status: "running" | "completed" | "failed";
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

interface AgentsSummary {
  totalAgents: number;
  activeAgents: number;
  unhealthyAgents: number;
  autoDisabledAgents: number;
  staleAgents: number;
  openIssues: number;
  escalatedIssues: number;
  openDeferredItems: number;
  recentFailingRuns: number;
}

interface AgentsResponse {
  agents: Agent[];
  configuredProviders: string[];
  issues: AgentIssue[];
  deferredItems: AgentDeferredItem[];
  recentFailingRuns?: AgentCronRun[];
  summary?: AgentsSummary;
}
interface AgentModelSettingsResponse {
  defaults: Record<AgentProviderName, string>;
  overrides: Partial<Record<AgentProviderName, string>>;
  effectiveModels: Record<AgentProviderName, string>;
  suggestions: Record<AgentProviderName, string[]>;
  providerOrder: AgentProviderName[];
}
interface TasksResponse { tasks: AgentTask[] }
interface LogsResponse { logs: AgentLog[] }

export default function AgentsContent() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "issues" | "deferred" | "tasks" | "logs"
  >("overview");
  const [triggering, setTriggering] = useState<string | null>(null);

  const { data: agentsData, isLoading, mutate: mutateAgents } = useSWR<AgentsResponse>(
    "/api/admin/agents",
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: tasksData, mutate: mutateTasks } = useSWR<TasksResponse>(
    "/api/admin/agents/tasks",
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: agentModelData, mutate: mutateAgentModels } =
    useSWR<AgentModelSettingsResponse>("/api/admin/agent-models", {
      ...SWR_TIERS.MEDIUM,
    });
  const { data: logsData } = useSWR<LogsResponse>(
    "/api/admin/agents/logs",
    { ...SWR_TIERS.MEDIUM }
  );

  const agents = agentsData?.agents ?? [];
  const configuredProviders = agentsData?.configuredProviders ?? [];
  const issues = agentsData?.issues ?? [];
  const deferredItems = agentsData?.deferredItems ?? [];
  const recentFailingRuns = agentsData?.recentFailingRuns ?? [];
  const summary = agentsData?.summary;
  const tasks = tasksData?.tasks ?? [];
  const logs = logsData?.logs ?? [];
  const [modelDrafts, setModelDrafts] = useState<Partial<Record<AgentProviderName, string>>>({});
  const [savingProvider, setSavingProvider] = useState<AgentProviderName | null>(null);

  useEffect(() => {
    if (!agentModelData) return;

    setModelDrafts((current) => {
      const next = { ...current };
      for (const provider of agentModelData.providerOrder ?? AGENT_PROVIDER_ORDER) {
        if (!(provider in current)) {
          next[provider] = agentModelData.overrides[provider] ?? "";
        }
      }
      return next;
    });
  }, [agentModelData]);

  const toggleAgent = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await fetch(`/api/admin/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    mutateAgents();
  };

  const triggerAgent = async (id: string) => {
    setTriggering(id);
    try {
      await fetch(`/api/admin/agents/${id}`, { method: "POST" });
      // Refresh after a brief delay
      setTimeout(() => {
        mutateAgents();
        mutateTasks();
      }, 2000);
    } catch {
      // ignore trigger errors
    } finally {
      setTriggering(null);
    }
  };

  const saveProviderModel = async (provider: AgentProviderName) => {
    setSavingProvider(provider);
    try {
      const res = await fetch("/api/admin/agent-models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: modelDrafts[provider] ?? "",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save provider model");
      }

      await mutateAgentModels();
    } catch {
      // handled by stale UI state for now
    } finally {
      setSavingProvider(null);
    }
  };

  const totalTasks = agents.reduce((sum, a) => sum + a.total_tasks_completed, 0);
  const totalErrors = agents.reduce((sum, a) => sum + a.error_count, 0);
  const activeCount = summary?.activeAgents ?? agents.filter((a) => a.status === "active").length;
  const unhealthyCount =
    summary?.unhealthyAgents ??
    agents.filter((agent) => agent.status !== "active" || agent.error_count > 0).length;
  const autoDisabledCount =
    summary?.autoDisabledAgents ?? agents.filter((agent) => agent.status === "error").length;
  const staleCount =
    summary?.staleAgents ??
    agents.filter((agent) => !agent.last_active_at).length;
  const openIssues = summary?.openIssues ?? issues.filter((issue) => issue.status === "open").length;
  const escalatedIssues =
    summary?.escalatedIssues ?? issues.filter((issue) => issue.status === "escalated").length;
  const pendingDeferred =
    summary?.openDeferredItems ??
    deferredItems.filter((item) => item.status !== "done" && item.status !== "dropped").length;
  const recentFailingRunCount = summary?.recentFailingRuns ?? recentFailingRuns.length;
  const issuePolicySummary = summarizeAutoPrPolicies(issues);

  const statusColor: Record<string, string> = {
    active: "text-emerald-400 bg-emerald-400/10",
    paused: "text-yellow-400 bg-yellow-400/10",
    disabled: "text-gray-400 bg-gray-400/10",
    error: "text-red-400 bg-red-400/10",
  };

  const taskStatusIcon: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
    running: <RefreshCw className="h-3.5 w-3.5 text-neon animate-spin" />,
    pending: <Clock className="h-3.5 w-3.5 text-yellow-400" />,
  };

  const severityColor: Record<string, string> = {
    critical: "text-red-300 bg-red-500/15",
    high: "text-red-400 bg-red-400/10",
    medium: "text-yellow-300 bg-yellow-500/10",
    low: "text-blue-300 bg-blue-500/10",
  };

  const riskColor: Record<string, string> = {
    high: "text-red-400 bg-red-400/10",
    medium: "text-yellow-300 bg-yellow-500/10",
    low: "text-emerald-300 bg-emerald-500/10",
  };

  const proposalColor: Record<string, string> = {
    draft_candidate: "text-emerald-300 bg-emerald-500/10",
    manual_only: "text-yellow-300 bg-yellow-500/10",
    blocked: "text-red-300 bg-red-500/15",
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-secondary" />
          ))}
        </div>
        <div className="h-96 rounded-xl bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Bot className="h-3.5 w-3.5" />
            Total Agents
          </div>
          <p className="text-2xl font-bold">{summary?.totalAgents ?? agents.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Activity className="h-3.5 w-3.5" />
            Active
          </div>
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Unhealthy
          </div>
          <p className="text-2xl font-bold text-red-400">{unhealthyCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <XCircle className="h-3.5 w-3.5" />
            Auto-disabled
          </div>
          <p className="text-2xl font-bold text-red-300">{autoDisabledCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Clock className="h-3.5 w-3.5" />
            Stale
          </div>
          <p className="text-2xl font-bold text-yellow-300">{staleCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tasks Done
          </div>
          <p className="text-2xl font-bold">{totalTasks}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Error Count
          </div>
          <p className="text-2xl font-bold text-red-400">{totalErrors}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Open Issues
          </div>
          <p className="text-2xl font-bold text-yellow-300">{openIssues}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Escalated
          </div>
          <p className="text-2xl font-bold text-red-300">{escalatedIssues}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Failed Runs
          </div>
          <p className="text-2xl font-bold text-red-300">{recentFailingRunCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Draft Candidates
          </div>
          <p className="text-2xl font-bold text-emerald-300">
            {issuePolicySummary.draftCandidateCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Clock className="h-3.5 w-3.5" />
            Deferred Items
          </div>
          <p className="text-2xl font-bold">{pendingDeferred}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary/30 p-1">
        {(["overview", "issues", "deferred", "tasks", "logs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-neon/10 text-neon"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Configured LLM Providers
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {configuredProviders.length > 0 ? (
                configuredProviders.map((provider) => (
                  <span
                    key={provider}
                    className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground"
                  >
                    {provider}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  No provider configured for agent model routing.
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              Agent Model Routing
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Override provider model IDs without changing API keys. Leave blank to use the built-in default.
            </p>
            <div className="mt-4 space-y-4">
              {(agentModelData?.providerOrder ?? AGENT_PROVIDER_ORDER).map((provider) => {
                const suggestions = agentModelData?.suggestions[provider] ?? [];
                const effectiveModel = agentModelData?.effectiveModels[provider] ?? "";
                const defaultModel = agentModelData?.defaults[provider] ?? "";
                const overrideValue = modelDrafts[provider] ?? "";

                return (
                  <div
                    key={provider}
                    className="rounded-lg border border-border/60 bg-secondary/10 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium capitalize">{provider}</div>
                        <div className="text-xs text-muted-foreground">
                          Effective: <span className="font-mono">{effectiveModel}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Default: <span className="font-mono">{defaultModel}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => saveProviderModel(provider)}
                        disabled={savingProvider === provider}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </button>
                    </div>
                    <input
                      list={`agent-model-suggestions-${provider}`}
                      value={overrideValue}
                      onChange={(event) =>
                        setModelDrafts((current) => ({
                          ...current,
                          [provider]: event.target.value,
                        }))
                      }
                      placeholder={`Use default (${defaultModel})`}
                      className="mt-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <datalist id={`agent-model-suggestions-${provider}`}>
                      {suggestions.map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Example suggestions: {suggestions.join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Recent Failing Scheduled Runs
            </div>
            <div className="mt-3 space-y-3">
              {recentFailingRuns.length > 0 ? (
                recentFailingRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{run.job_name}</span>
                      <span className="rounded px-2 py-0.5 text-xs text-red-300 bg-red-500/15">
                        {run.status}
                      </span>
                    </div>
                    {run.error_message ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {run.error_message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Started {new Date(run.started_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recent failing scheduled agent runs.
                </p>
              )}
            </div>
          </div>

          {agents.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No agents registered yet
            </div>
          )}
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{agent.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${statusColor[agent.status] ?? ""}`}
                    >
                      {agent.status}
                    </span>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      {agent.agent_type}
                    </span>
                    {(agent.status !== "active" || agent.error_count > 0) && (
                      <span className="text-xs px-2 py-0.5 rounded text-red-300 bg-red-500/15">
                        unhealthy
                      </span>
                    )}
                    {!agent.last_active_at && (
                      <span className="text-xs px-2 py-0.5 rounded text-yellow-300 bg-yellow-500/10">
                        stale
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {agent.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right text-xs text-muted-foreground mr-2">
                    <div>{agent.total_tasks_completed} tasks</div>
                    <div>{agent.total_conversations} chats</div>
                    {agent.last_active_at && (
                      <div>
                        Last: {new Date(agent.last_active_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAgent(agent.id, agent.status)}
                    className="rounded-lg p-2 hover:bg-secondary transition-colors"
                    title={agent.status === "active" ? "Pause" : "Resume"}
                  >
                    {agent.status === "active" ? (
                      <Pause className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <Play className="h-4 w-4 text-emerald-400" />
                    )}
                  </button>
                  <button
                    onClick={() => triggerAgent(agent.id)}
                    disabled={triggering === agent.id}
                    className="rounded-lg p-2 hover:bg-secondary transition-colors disabled:opacity-50"
                    title="Trigger manual run"
                  >
                    <RefreshCw
                      className={`h-4 w-4 text-neon ${triggering === agent.id ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "issues" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Issue
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Severity
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Playbook
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Proposal
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Source
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {issues.map((issue) => {
                const proposal = extractAutoPrPolicy(issue.evidence);

                return (
                  <tr key={issue.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{issue.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {issue.issue_type} · {issue.status}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${severityColor[issue.severity] ?? ""}`}
                      >
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.playbook ?? "manual"}
                    </td>
                    <td className="px-4 py-3">
                      {proposal ? (
                        <div className="space-y-1">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${proposalColor[proposal.decision] ?? ""}`}
                          >
                            {proposal.decision.replaceAll("_", " ")}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {proposal.proposalTitle ?? proposal.summary}
                          </div>
                          {proposal.branchSlug && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {proposal.branchSlug}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          no proposal metadata
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.source ?? "platform"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                      {new Date(issue.updated_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {issues.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No ledger issues recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "deferred" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Item
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Risk
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Required Before
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Owner
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deferredItems.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.area} · {item.status}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.reason}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${riskColor[item.risk_level] ?? ""}`}
                    >
                      {item.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.required_before ?? "later"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.owner_hint ?? "unassigned"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {new Date(item.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {deferredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No deferred items recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Agent
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Model
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Error
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    {task.agents?.name ?? task.agent_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {task.task_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {taskStatusIcon[task.status] ?? null}
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {task.llm?.provider || task.llm?.model ? (
                      <div>
                        <div className="capitalize">{task.llm.provider ?? "unknown"}</div>
                        <div className="font-mono">{task.llm.model ?? "unknown"}</div>
                      </div>
                    ) : (
                      "n/a"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">
                    {task.error_message}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No tasks yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Agent
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Level
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Message
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    {log.agents?.name ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        log.level === "error"
                          ? "text-red-400 bg-red-400/10"
                          : log.level === "warn"
                            ? "text-yellow-400 bg-yellow-400/10"
                            : log.level === "info"
                              ? "text-blue-400 bg-blue-400/10"
                              : "text-gray-400 bg-gray-400/10"
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md truncate">
                    {log.message}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

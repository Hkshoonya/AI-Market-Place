import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSWR = vi.hoisted(() => vi.fn());

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg aria-hidden="true" />;
  return {
    Bot: Icon,
    Play: Icon,
    Pause: Icon,
    RefreshCw: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Clock: Icon,
    AlertTriangle: Icon,
    Activity: Icon,
    Save: Icon,
  };
});

import AgentsContent from "./agents-content";

describe("AgentsContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mutate = vi.fn();
    const agentsResponse = {
      agents: [
        {
          id: "agent-1",
          slug: "pipeline-engineer",
          name: "Pipeline Engineer",
          description: "Maintains pipeline health",
          agent_type: "resident",
          status: "active",
          capabilities: ["verify", "repair"],
          total_tasks_completed: 12,
          total_conversations: 3,
          error_count: 0,
          last_active_at: "2026-03-20T11:30:00.000Z",
        },
      ],
      configuredProviders: ["openrouter"],
      issues: [
        {
          id: "issue-1",
          slug: "agent-stale-task-pipeline-engineer",
          title: "Pipeline engineer task is stuck",
          issue_type: "stale_running_task",
          source: "runtime",
          severity: "high",
          status: "escalated",
          playbook: "cleanup_stale_task",
          evidence: null,
          verification: {
            status: "auto_disabled",
            reason: "agent exceeded failure threshold during verification",
          },
          retry_count: 2,
          escalated_at: "2026-03-20T12:15:00.000Z",
          updated_at: "2026-03-20T12:20:00.000Z",
        },
      ],
      deferredItems: [],
      recentFailingRuns: [],
      staleRunningTasks: [
        {
          id: "task-1",
          agent_id: "agent-1",
          task_type: "scheduled_run",
          status: "running",
          started_at: "2026-03-20T10:00:00.000Z",
          created_at: "2026-03-20T10:00:00.000Z",
          agents: { name: "Pipeline Engineer", slug: "pipeline-engineer" },
        },
      ],
      summary: {
        totalAgents: 1,
        activeAgents: 1,
        unhealthyAgents: 0,
        autoDisabledAgents: 0,
        staleAgents: 0,
        openIssues: 0,
        escalatedIssues: 1,
        openDeferredItems: 0,
        recentFailingRuns: 0,
        staleRunningTasks: 1,
      },
    };
    const tasksResponse = { tasks: [] };
    const modelSettingsResponse = {
      defaults: { openrouter: "openai/gpt-5.4-mini" },
      overrides: {},
      effectiveModels: { openrouter: "openai/gpt-5.4-mini" },
      suggestions: { openrouter: ["openai/gpt-5.4-mini"] },
      providerOrder: ["openrouter"],
    };
    const logsResponse = { logs: [] };

    mockUseSWR.mockImplementation((key: string) => {
      if (key === "/api/admin/agents") {
        return {
          data: agentsResponse,
          isLoading: false,
          mutate,
        };
      }

      if (key === "/api/admin/agents/tasks") {
        return {
          data: tasksResponse,
          mutate,
        };
      }

      if (key === "/api/admin/agent-models") {
        return {
          data: modelSettingsResponse,
          mutate,
        };
      }

      if (key === "/api/admin/agents/logs") {
        return {
          data: logsResponse,
        };
      }

      return { data: undefined, isLoading: false, mutate: vi.fn() };
    });
  });

  it("renders escalation and stuck-task operator details", async () => {
    const user = userEvent.setup();

    render(<AgentsContent />);

    expect(screen.getByText(/stuck for/i)).toBeInTheDocument();
    expect(screen.getByText("pipeline-engineer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "issues" }));

    expect(screen.getByText(/pipeline engineer task is stuck/i)).toBeInTheDocument();
    expect(screen.getByText(/retries 2/i)).toBeInTheDocument();
    expect(screen.getByText(/auto disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/stale task recovery/i)).toBeInTheDocument();
    expect(
      screen.getByText(/clear the stuck task, then confirm the next scheduled run succeeds/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/agent exceeded failure threshold during verification/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/escalated/i).length).toBeGreaterThan(0);
  });

  it("renders deferred items with clean labels instead of mojibake and vague fallbacks", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    const agentsResponse = {
      agents: [],
      configuredProviders: ["openrouter"],
      issues: [],
      deferredItems: [
        {
          id: "deferred-1",
          title: "Backfill seller verification notes",
          area: "marketplace",
          status: "open",
          reason: "Needs manual review after launch traffic settles.",
          risk_level: "medium",
          required_before: null,
          owner_hint: null,
          updated_at: "2026-03-20T12:20:00.000Z",
        },
      ],
      recentFailingRuns: [],
      staleRunningTasks: [],
      summary: {
        totalAgents: 0,
        activeAgents: 0,
        unhealthyAgents: 0,
        autoDisabledAgents: 0,
        staleAgents: 0,
        openIssues: 0,
        escalatedIssues: 0,
        openDeferredItems: 1,
        recentFailingRuns: 0,
        staleRunningTasks: 0,
      },
    };

    mockUseSWR.mockImplementation((key: string) => {
      if (key === "/api/admin/agents") {
        return { data: agentsResponse, isLoading: false, mutate };
      }
      if (key === "/api/admin/agents/tasks") {
        return { data: { tasks: [] }, mutate };
      }
      if (key === "/api/admin/agent-models") {
        return {
          data: {
            defaults: { openrouter: "openai/gpt-5.4-mini" },
            overrides: {},
            effectiveModels: { openrouter: "openai/gpt-5.4-mini" },
            suggestions: { openrouter: ["openai/gpt-5.4-mini"] },
            providerOrder: ["openrouter"],
          },
          mutate,
        };
      }
      if (key === "/api/admin/agents/logs") {
        return { data: { logs: [] } };
      }
      return { data: undefined, isLoading: false, mutate: vi.fn() };
    });

    render(<AgentsContent />);

    await user.click(screen.getByRole("button", { name: "deferred" }));

    expect(screen.getByText("marketplace - open")).toBeInTheDocument();
    expect(screen.getByText(/no blocking milestone/i)).toBeInTheDocument();
    expect(screen.queryByText(/Â·/i)).not.toBeInTheDocument();
  });
});

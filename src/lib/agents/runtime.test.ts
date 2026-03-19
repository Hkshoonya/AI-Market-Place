import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLoadAllAgents = vi.fn();
const mockGetAgent = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateAgentLogger = vi.fn();
const mockRecordAgentIssue = vi.fn();
const mockResolveAgentIssue = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("./registry", () => ({
  loadAllAgents: (...args: unknown[]) => mockLoadAllAgents(...args),
  getAgent: (...args: unknown[]) => mockGetAgent(...args),
}));

vi.mock("./logger", () => ({
  createAgentLogger: (...args: unknown[]) => mockCreateAgentLogger(...args),
}));

vi.mock("./ledger", () => ({
  recordAgentIssue: (...args: unknown[]) => mockRecordAgentIssue(...args),
  resolveAgentIssue: (...args: unknown[]) => mockResolveAgentIssue(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: (...args: unknown[]) => mockError(...args),
  }),
}));

import { executeAgent } from "./runtime";

function createSupabaseStub(agentOverrides?: Partial<Record<string, unknown>>) {
  const updates: Array<Record<string, unknown>> = [];
  const agentRecord = {
    id: "agent-1",
    slug: "pipeline-engineer",
    name: "Pipeline Engineer",
    description: null,
    agent_type: "resident",
    owner_id: null,
    status: "active",
    capabilities: [],
    config: {},
    mcp_endpoint: null,
    api_key_hash: null,
    last_active_at: "2026-03-19T00:00:00.000Z",
    total_tasks_completed: 2,
    total_conversations: 0,
    error_count: 9,
    created_at: "2026-03-19T00:00:00.000Z",
    updated_at: "2026-03-19T00:00:00.000Z",
    ...agentOverrides,
  };
  const taskRecord = {
    id: "task-1",
    agent_id: "agent-1",
    task_type: "scheduled_run",
    status: "running",
    priority: 5,
    input: {},
    output: null,
    error_message: null,
    started_at: "2026-03-19T00:00:00.000Z",
    completed_at: null,
    created_at: "2026-03-19T00:00:00.000Z",
  };

  const agentUpdateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const taskUpdateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: agentRecord, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push({ table, payload });
            return agentUpdateChain;
          },
        };
      }

      if (table === "agent_tasks") {
        return {
          select: () => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
            return chain;
          },
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: taskRecord, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push({ table, payload });
            return taskUpdateChain;
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    updates,
  };

  return client;
}

describe("executeAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAllAgents.mockResolvedValue(undefined);
    mockCreateAgentLogger.mockReturnValue({
      info: vi.fn().mockResolvedValue(undefined),
      warn: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined),
      debug: vi.fn().mockResolvedValue(undefined),
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  it("records an escalated runtime issue when an agent auto-disables after repeated failures", async () => {
    const supabase = createSupabaseStub({ error_count: 9 });
    mockCreateClient.mockReturnValue(supabase);
    mockGetAgent.mockReturnValue({
      slug: "pipeline-engineer",
      name: "Pipeline Engineer",
      run: vi.fn().mockResolvedValue({
        success: false,
        output: {},
        errors: ["boom"],
      }),
    });

    const result = await executeAgent("pipeline-engineer", "scheduled_run");

    expect(result.success).toBe(false);
    expect(mockRecordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slug: "agent-runtime-pipeline-engineer",
        status: "escalated",
        retryCount: 10,
      })
    );
    expect(supabase.updates).toContainEqual({
      table: "agents",
      payload: expect.objectContaining({
        error_count: 10,
        status: "error",
      }),
    });
  });

  it("resolves the runtime issue when a previously failing agent succeeds again", async () => {
    const supabase = createSupabaseStub({ error_count: 2, total_tasks_completed: 7 });
    mockCreateClient.mockReturnValue(supabase);
    mockGetAgent.mockReturnValue({
      slug: "pipeline-engineer",
      name: "Pipeline Engineer",
      run: vi.fn().mockResolvedValue({
        success: true,
        output: { ok: true },
        errors: [],
      }),
    });

    const result = await executeAgent("pipeline-engineer", "scheduled_run");

    expect(result.success).toBe(true);
    expect(mockResolveAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      "agent-runtime-pipeline-engineer",
      expect.objectContaining({
        verifier: "runtime",
      })
    );
    expect(supabase.updates).toContainEqual({
      table: "agents",
      payload: expect.objectContaining({
        error_count: 0,
        total_tasks_completed: 8,
      }),
    });
  });

  it("skips execution when another running task already exists for the same agent", async () => {
    const supabase = createSupabaseStub({ error_count: 0 });
    supabase.from = vi.fn((table: string) => {
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "agent-1",
                  slug: "pipeline-engineer",
                  name: "Pipeline Engineer",
                  description: null,
                  agent_type: "resident",
                  owner_id: null,
                  status: "active",
                  capabilities: [],
                  config: {},
                  mcp_endpoint: null,
                  api_key_hash: null,
                  last_active_at: "2026-03-19T00:00:00.000Z",
                  total_tasks_completed: 2,
                  total_conversations: 0,
                  error_count: 0,
                  created_at: "2026-03-19T00:00:00.000Z",
                  updated_at: "2026-03-19T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            supabase.updates.push({ table, payload });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      if (table === "agent_tasks") {
        return {
          select: () => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "task-running",
                  started_at: new Date(Date.now() - 60_000).toISOString(),
                  task_type: "scheduled_run",
                },
                error: null,
              }),
            };
            return chain;
          },
          insert: vi.fn(() => {
            throw new Error("should not create a duplicate task");
          }),
          update: (payload: Record<string, unknown>) => {
            supabase.updates.push({ table, payload });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockReturnValue(supabase);
    mockGetAgent.mockReturnValue({
      slug: "pipeline-engineer",
      name: "Pipeline Engineer",
      run: vi.fn(),
    });

    const result = await executeAgent("pipeline-engineer", "scheduled_run");

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.taskId).toBe("task-running");
    expect(result.output).toEqual(
      expect.objectContaining({
        skippedReason: "agent_run_already_in_progress",
        runningTaskId: "task-running",
      })
    );
    expect(supabase.updates).toHaveLength(0);
  });

  it("auto-fails stale running tasks and records an issue before starting a new run", async () => {
    const supabase = createSupabaseStub({ error_count: 0, total_tasks_completed: 3 });
    supabase.from = vi.fn((table: string) => {
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "agent-1",
                  slug: "pipeline-engineer",
                  name: "Pipeline Engineer",
                  description: null,
                  agent_type: "resident",
                  owner_id: null,
                  status: "active",
                  capabilities: [],
                  config: {},
                  mcp_endpoint: null,
                  api_key_hash: null,
                  last_active_at: "2026-03-19T00:00:00.000Z",
                  total_tasks_completed: 3,
                  total_conversations: 0,
                  error_count: 0,
                  created_at: "2026-03-19T00:00:00.000Z",
                  updated_at: "2026-03-19T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            supabase.updates.push({ table, payload });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      if (table === "agent_tasks") {
        return {
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "task-stale",
                started_at: "2026-03-19T00:00:00.000Z",
                task_type: "scheduled_run",
              },
              error: null,
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "task-2",
                  agent_id: "agent-1",
                  task_type: "scheduled_run",
                  status: "running",
                  priority: 5,
                  input: {},
                  output: null,
                  error_message: null,
                  started_at: "2026-03-19T02:00:00.000Z",
                  completed_at: null,
                  created_at: "2026-03-19T02:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            supabase.updates.push({ table, payload });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockReturnValue(supabase);
    mockGetAgent.mockReturnValue({
      slug: "pipeline-engineer",
      name: "Pipeline Engineer",
      run: vi.fn().mockResolvedValue({
        success: true,
        output: { ok: true },
        errors: [],
      }),
    });

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-03-19T02:00:00.000Z").getTime()
    );

    const result = await executeAgent("pipeline-engineer", "scheduled_run", {}, 300_000);

    nowSpy.mockRestore();

    expect(result.success).toBe(true);
    expect(mockRecordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slug: "agent-stale-task-pipeline-engineer",
        issueType: "stale_running_task",
      })
    );
    expect(supabase.updates).toContainEqual({
      table: "agent_tasks",
      payload: expect.objectContaining({
        status: "failed",
        error_message: "Marked failed by runtime after exceeding timeout of 300000ms",
      }),
    });
  });
});

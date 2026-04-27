import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockExecuteAgent = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/agents/runtime", () => ({
  executeAgent: (...args: unknown[]) => mockExecuteAgent(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: {
    write: { limit: 20, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { PATCH, POST } from "./route";

function createSessionClient(agentRecord?: {
  id?: string;
  slug?: string;
  status?: string;
  error_count?: number;
}) {
  const updates: Array<Record<string, unknown>> = [];
  const record = {
    id: "agent-1",
    slug: "pipeline-engineer",
    status: "error",
    error_count: 10,
    ...agentRecord,
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1" } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { is_admin: true },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: record,
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    updates,
  };
}

describe("admin agent control route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteAgent.mockResolvedValue({
      success: true,
      agentSlug: "pipeline-engineer",
      taskId: "task-1",
      durationMs: 100,
      output: {},
      errors: [],
    });
  });

  it("resets error_count when re-activating an auto-disabled agent", async () => {
    const supabase = createSessionClient();
    mockCreateClient.mockResolvedValue(supabase);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/admin/agents/agent-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ status: "active" }),
      }),
      { params: Promise.resolve({ id: "agent-1" }) }
    );

    expect(response.status).toBe(200);
    expect(supabase.updates[0]).toEqual(
      expect.objectContaining({
        status: "active",
        error_count: 0,
      })
    );
  });

  it("blocks manual trigger for non-active agents", async () => {
    mockCreateClient.mockResolvedValue(
      createSessionClient({ status: "error", error_count: 10 })
    );

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/agents/agent-1", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      }),
      { params: Promise.resolve({ id: "agent-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/must be active/i);
    expect(mockExecuteAgent).not.toHaveBeenCalled();
  });

  it("allows manual trigger for active agents", async () => {
    mockCreateClient.mockResolvedValue(
      createSessionClient({ status: "active", error_count: 0 })
    );

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/agents/agent-1", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      }),
      { params: Promise.resolve({ id: "agent-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockExecuteAgent).toHaveBeenCalledWith(
      "pipeline-engineer",
      "manual_trigger"
    );
  });

  it("returns 409 when a manual trigger is skipped because the agent is already running", async () => {
    mockExecuteAgent.mockResolvedValue({
      success: false,
      skipped: true,
      agentSlug: "pipeline-engineer",
      taskId: "task-running",
      durationMs: 3,
      output: { skippedReason: "agent_run_already_in_progress" },
      errors: ["Agent \"pipeline-engineer\" already has a running task in progress."],
    });
    mockCreateClient.mockResolvedValue(
      createSessionClient({ status: "active", error_count: 0 })
    );

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/agents/agent-1", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      }),
      { params: Promise.resolve({ id: "agent-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.taskId).toBe("task-running");
  });

  it("rejects cross-origin admin agent status updates", async () => {
    const supabase = createSessionClient();
    mockCreateClient.mockResolvedValue(supabase);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/admin/agents/agent-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ status: "active" }),
      }),
      { params: Promise.resolve({ id: "agent-1" }) }
    );

    expect(response.status).toBe(403);
    expect(supabase.updates).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: { public: { limit: 60, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const createClientMock = vi.mocked(createClient);

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/agents/tasks");
}

function createSessionClient(options: { user: { id: string } | null; isAdmin: boolean }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: options.user ? { is_admin: options.isAdmin } : null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "agent_tasks") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    id: "task-1",
                    agent_id: "agent-1",
                    task_type: "daily_scan",
                    status: "completed",
                    started_at: "2026-03-19T12:00:00.000Z",
                    completed_at: "2026-03-19T12:01:00.000Z",
                    error_message: null,
                    created_at: "2026-03-19T12:00:00.000Z",
                    output: {
                      analysisResults: [
                        {
                          llmProvider: "openrouter",
                          llmModel: "minimax/minimax-m2.5",
                        },
                      ],
                    },
                    agents: { name: "Code Quality Monitor", slug: "code-quality" },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/admin/agents/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes extracted llm metadata in task rows", async () => {
    createClientMock.mockResolvedValue(
      createSessionClient({ user: { id: "admin-1" }, isAdmin: true }) as never
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].llm).toEqual({
      provider: "openrouter",
      model: "minimax/minimax-m2.5",
    });
  });
});

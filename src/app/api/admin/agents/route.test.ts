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

vi.mock("@/lib/agents/provider-router", () => ({
  listConfiguredAgentProviders: vi.fn(() => ["openrouter", "anthropic"]),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/agents");
}

function createMockSessionClient(options: {
  user: { id: string } | null;
  isAdmin: boolean;
}) {
  const agentsChain = {
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: "agent-1",
          slug: "pipeline-engineer",
          name: "Pipeline Engineer",
          agent_type: "resident",
          status: "active",
          error_count: 0,
          last_active_at: "2026-03-19T12:00:00.000Z",
        },
        {
          id: "agent-2",
          slug: "ux-monitor",
          name: "UX Monitor",
          agent_type: "resident",
          status: "error",
          error_count: 10,
          last_active_at: null,
        },
      ],
      error: null,
    }),
  };

  const issuesChain = {
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: "issue-1",
          slug: "pipeline-source-openrouter-models",
          title: "Pipeline issue for openrouter-models",
          status: "open",
          severity: "high",
        },
      ],
      error: null,
    }),
  };

  const deferredChain = {
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: "deferred-1",
          slug: "marketplace-fee-policy",
          title: "Marketplace fee policy",
          status: "open",
          risk_level: "medium",
        },
      ],
      error: null,
    }),
  };

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

      if (table === "agents") {
        return {
          select: () => agentsChain,
        };
      }

      if (table === "agent_issues") {
        return {
          select: () => issuesChain,
        };
      }

      if (table === "agent_deferred_items") {
        return {
          select: () => deferredChain,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/admin/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSessionClient({ user: null, isAdmin: false }) as never
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSessionClient({ user: { id: "user-1" }, isAdmin: false }) as never
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it("returns provider and ledger data for admins", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSessionClient({ user: { id: "admin-1" }, isAdmin: true }) as never
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.agents).toHaveLength(2);
    expect(body.configuredProviders).toEqual(["openrouter", "anthropic"]);
    expect(body.issues).toHaveLength(1);
    expect(body.deferredItems).toHaveLength(1);
    expect(body.summary).toEqual(
      expect.objectContaining({
        totalAgents: 2,
        activeAgents: 1,
        unhealthyAgents: 1,
        autoDisabledAgents: 1,
        staleAgents: 1,
        openIssues: 1,
        escalatedIssues: 0,
        openDeferredItems: 1,
      })
    );
  });
});

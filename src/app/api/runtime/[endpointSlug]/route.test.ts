import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthUser = vi.fn();
const single = vi.fn();
const eq = vi.fn();
const from = vi.fn();

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: (...args: unknown[]) => resolveAuthUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
  }),
}));

describe("GET /api/runtime/[endpointSlug]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    eq.mockImplementation(() => ({
      eq,
      single,
    }));
    from.mockImplementation((table: string) => {
      if (table !== "workspace_runtimes") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq,
        }),
      };
    });
  });

  it("returns runtime status for an authenticated owner", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["agent"],
    });
    single.mockResolvedValue({
      data: {
        id: "runtime-1",
        model_slug: "openai-gpt-4-1",
        model_name: "GPT-4.1",
        provider_name: "ChatGPT Plus",
        status: "ready",
        endpoint_slug: "openai-gpt-4-1-abc12345",
        total_requests: 2,
        total_tokens: 90,
        last_used_at: "2026-04-01T13:00:00.000Z",
        updated_at: "2026-04-01T13:30:00.000Z",
      },
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://aimarketcap.tech/api/runtime/openai-gpt-4-1-abc12345") as never, {
      params: Promise.resolve({ endpointSlug: "openai-gpt-4-1-abc12345" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.runtime.assistantPath).toBe("/api/runtime/openai-gpt-4-1-abc12345/assistant");
  });
});

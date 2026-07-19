import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";

const resolveAuthUser = vi.fn();
const single = vi.fn();
const deploymentMaybeSingle = vi.fn();
const eq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const from = vi.fn();
const resolveAvailableWorkspaceRuntimeExecution = vi.fn();

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: (...args: unknown[]) => resolveAuthUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
  }),
}));

vi.mock("@/lib/workspace/runtime-availability", () => ({
  resolveAvailableWorkspaceRuntimeExecution: (modelSlug: string) =>
    resolveAvailableWorkspaceRuntimeExecution(modelSlug),
}));

describe("GET /api/runtime/[endpointSlug]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resolveAvailableWorkspaceRuntimeExecution.mockImplementation(async (modelSlug: string) =>
      resolveWorkspaceRuntimeExecution(modelSlug)
    );

    updateEq.mockResolvedValue({ error: null });
    update.mockImplementation(() => ({
      eq: updateEq,
    }));
    eq.mockImplementation(() => ({
      eq,
      single,
      maybeSingle: deploymentMaybeSingle,
    }));
    from.mockImplementation((table: string) => {
      if (table === "workspace_runtimes") {
        return {
          select: () => ({
            eq,
          }),
          update,
        };
      }

      if (table === "workspace_deployments") {
        return {
          select: () => ({
            eq,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    deploymentMaybeSingle.mockResolvedValue({
      data: { endpoint_slug: "openai-gpt-4-1-metered" },
      error: null,
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

  it("moves legacy runtime invocations to the metered deployment endpoint", async () => {
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
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/runtime/openai-gpt-4-1-abc12345", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      }) as never,
      { params: Promise.resolve({ endpointSlug: "openai-gpt-4-1-abc12345" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "metered_deployment_required",
      endpointPath: "/api/deployments/openai-gpt-4-1-metered",
    });
  });

  it("rejects cross-origin session runtime invocations", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "session",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/runtime/openai-gpt-4-1-abc12345", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ message: "Hello" }),
      }) as never,
      { params: Promise.resolve({ endpointSlug: "openai-gpt-4-1-abc12345" }) }
    );

    expect(response.status).toBe(403);
    expect(deploymentMaybeSingle).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/agents/provider-model-config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/provider-model-config")>(
    "@/lib/agents/provider-model-config"
  );
  return {
    ...actual,
    getAgentProviderModelOverrides: vi.fn(),
    getEffectiveAgentProviderModels: vi.fn(),
    clearAgentProviderModelOverrideCache: vi.fn(),
  };
});

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearAgentProviderModelOverrideCache,
  getAgentProviderModelOverrides,
  getEffectiveAgentProviderModels,
} from "@/lib/agents/provider-model-config";
import { GET, PATCH } from "./route";

const createClientMock = vi.mocked(createClient);
const createAdminClientMock = vi.mocked(createAdminClient);
const getAgentProviderModelOverridesMock = vi.mocked(getAgentProviderModelOverrides);
const getEffectiveAgentProviderModelsMock = vi.mocked(getEffectiveAgentProviderModels);
const clearAgentProviderModelOverrideCacheMock = vi.mocked(
  clearAgentProviderModelOverrideCache
);

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

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createAdminClientStub() {
  return {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  };
}

describe("admin agent model settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAgentProviderModelOverridesMock.mockResolvedValue({ openrouter: "minimax/minimax-m2.5" });
    getEffectiveAgentProviderModelsMock.mockResolvedValue({
      openrouter: "minimax/minimax-m2.5",
      deepseek: "deepseek-chat",
      minimax: "MiniMax-M2.5",
      anthropic: "claude-sonnet-4-20250514",
    });
  });

  it("returns settings for admins", async () => {
    createClientMock.mockResolvedValue(
      createSessionClient({ user: { id: "admin-1" }, isAdmin: true }) as never
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overrides.openrouter).toBe("minimax/minimax-m2.5");
    expect(body.effectiveModels.minimax).toBe("MiniMax-M2.5");
  });

  it("rejects non-admin updates", async () => {
    createClientMock.mockResolvedValue(
      createSessionClient({ user: { id: "user-1" }, isAdmin: false }) as never
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/agent-models", {
        method: "PATCH",
        body: JSON.stringify({ provider: "openrouter", model: "minimax/minimax-m2.5" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("updates an override and clears the cache", async () => {
    createClientMock.mockResolvedValue(
      createSessionClient({ user: { id: "admin-1" }, isAdmin: true }) as never
    );
    createAdminClientMock.mockReturnValue(createAdminClientStub() as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/agent-models", {
        method: "PATCH",
        body: JSON.stringify({ provider: "openrouter", model: "minimax/minimax-m2.5:nitro" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createAdminClientMock).toHaveBeenCalled();
    expect(clearAgentProviderModelOverrideCacheMock).toHaveBeenCalled();
    expect(body.effectiveModels.openrouter).toBe("minimax/minimax-m2.5");
  });
});

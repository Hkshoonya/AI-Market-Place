import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearReplicateCatalogCacheForTests,
  resolveWorkspaceProvisioningOption,
} from "./external-deployment";

function createSupabaseModelLookup(model: {
  slug: string;
  name: string;
  provider: string;
  category: string | null;
  parameter_count: number | null;
  hf_model_id?: string | null;
} | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: model, error: null }),
        }),
      }),
    }),
  };
}

describe("resolveWorkspaceProvisioningOption", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearReplicateCatalogCacheForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearReplicateCatalogCacheForTests();
    vi.restoreAllMocks();
  });

  it("prefers the existing managed runtime path when available", async () => {
    const option = await resolveWorkspaceProvisioningOption({
      supabase: createSupabaseModelLookup(null),
      modelSlug: "openai-gpt-4-1",
      runtimeExecution: {
        available: true,
        label: "OpenRouter-backed runtime",
        summary: "Managed here.",
      },
    });

    expect(option).toMatchObject({
      canCreate: true,
      deploymentKind: "managed_api",
      label: "OpenRouter-backed runtime",
    });
  });

  it("uses the static Replicate mapping for supported open-weight models", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          owner: "meta",
          name: "llama-3.3-70b-instruct",
          latest_version: {
            id: "version-1",
            openapi_schema: {
              components: {
                schemas: {
                  Input: {
                    properties: {
                      prompt: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const option = await resolveWorkspaceProvisioningOption({
      supabase: createSupabaseModelLookup({
        slug: "meta-llama-3-3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        provider: "Meta",
        category: "llm",
        parameter_count: 70_000_000_000,
        hf_model_id: "meta-llama/Llama-3.3-70B-Instruct",
      }),
      modelSlug: "meta-llama-3-3-70b-instruct",
      runtimeExecution: {
        available: false,
        label: "Unavailable",
        summary: "Unavailable",
      },
    });

    expect(option.canCreate).toBe(true);
    expect(option.deploymentKind).toBe("hosted_external");
    expect(option.target?.modelRef).toBe("meta/llama-3.3-70b-instruct");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the live Replicate catalog for models outside the static list", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                owner: "qwen",
                name: "qwen3-32b",
                url: "https://replicate.com/qwen/qwen3-32b",
              },
            ],
            next: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            owner: "qwen",
            name: "qwen3-32b",
            latest_version: {
              id: "version-1",
              openapi_schema: {
                components: {
                  schemas: {
                    Input: {
                      properties: {
                        prompt: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", mockFetch);

    const option = await resolveWorkspaceProvisioningOption({
      supabase: createSupabaseModelLookup({
        slug: "qwen-qwen3-32b",
        name: "Qwen3 32B",
        provider: "Qwen",
        category: "llm",
        parameter_count: null,
        hf_model_id: "Qwen/Qwen3-32B",
      }),
      modelSlug: "qwen-qwen3-32b",
      runtimeExecution: {
        available: false,
        label: "Unavailable",
        summary: "Unavailable",
      },
    });

    expect(option.canCreate).toBe(true);
    expect(option.deploymentKind).toBe("hosted_external");
    expect(option.target?.owner).toBe("qwen");
    expect(option.target?.name).toBe("qwen3-32b");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects live catalog models that do not expose a chat-style text input", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                owner: "qwen",
                name: "qwen3-tts",
                url: "https://replicate.com/qwen/qwen3-tts",
              },
            ],
            next: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            owner: "qwen",
            name: "qwen3-tts",
            latest_version: {
              id: "version-1",
              openapi_schema: {
                components: {
                  schemas: {
                    Input: {
                      properties: {
                        text: { type: "string" },
                        voice: { type: "string" },
                        speaker: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", mockFetch);

    const option = await resolveWorkspaceProvisioningOption({
      supabase: createSupabaseModelLookup({
        slug: "qwen-qwen3-tts",
        name: "Qwen3 TTS",
        provider: "Qwen",
        category: "speech_audio",
        parameter_count: null,
        hf_model_id: "Qwen/Qwen3-TTS",
      }),
      modelSlug: "qwen-qwen3-tts",
      runtimeExecution: {
        available: false,
        label: "Unavailable",
        summary: "Unavailable",
      },
    });

    expect(option.canCreate).toBe(false);
    expect(option.deploymentKind).toBe("assistant_only");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns assistant-only when neither managed nor hosted provisioning is available", async () => {
    delete process.env.REPLICATE_API_TOKEN;

    const option = await resolveWorkspaceProvisioningOption({
      supabase: createSupabaseModelLookup({
        slug: "kimi-k2",
        name: "Kimi K2",
        provider: "Moonshot AI",
        category: "llm",
        parameter_count: null,
      }),
      modelSlug: "kimi-k2",
      runtimeExecution: {
        available: false,
        label: "Unavailable",
        summary: "Unavailable",
      },
    });

    expect(option).toMatchObject({
      canCreate: false,
      deploymentKind: "assistant_only",
    });
  });
});

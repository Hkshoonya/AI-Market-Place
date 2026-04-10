import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearReplicateCatalogCacheForTests,
  deleteHostedDeployment,
  refreshHostedDeploymentStatus,
  resolveWorkspaceProvisioningOption,
  runHuggingFaceDeployment,
  updateHostedDeploymentScale,
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

  it("uses Hugging Face hosted inference for warm HF-backed chat models", async () => {
    process.env.HUGGINGFACE_API_TOKEN = "hf-test-token";
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "Qwen/Qwen2.5-7B-Instruct",
          inference: "warm",
          pipeline_tag: "text-generation",
          disabled: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const option = await resolveWorkspaceProvisioningOption({
      supabase: createSupabaseModelLookup({
        slug: "qwen-qwen2-5-7b-instruct",
        name: "Qwen2.5 7B Instruct",
        provider: "Qwen",
        category: "llm",
        parameter_count: null,
        hf_model_id: "Qwen/Qwen2.5-7B-Instruct",
      }),
      modelSlug: "qwen-qwen2-5-7b-instruct",
      runtimeExecution: {
        available: false,
        label: "Unavailable",
        summary: "Unavailable",
      },
    });

    expect(option.canCreate).toBe(true);
    expect(option.deploymentKind).toBe("hosted_external");
    expect(option.label).toBe("AI Market Cap hosted deployment");
    expect(option.target?.provider).toBe("huggingface");
    expect(option.target?.modelRef).toBe("Qwen/Qwen2.5-7B-Instruct");
  });
});

describe("hosted deployment lifecycle helpers", () => {
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

  it("maps a scaled-down Replicate deployment to paused", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          owner: "meta",
          name: "llama-3.3-70b-instruct",
          current_release: {
            model: "meta/llama-3.3-70b-instruct",
            version: "version-1",
            configuration: {
              min_instances: 0,
              max_instances: 0,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const snapshot = await refreshHostedDeploymentStatus({
      provider: "replicate",
      owner: "meta",
      name: "llama-3.3-70b-instruct",
    });

    expect(snapshot).toEqual({
      status: "paused",
      externalWebUrl: "https://replicate.com/meta/llama-3.3-70b-instruct",
      externalModelRef: "meta/llama-3.3-70b-instruct",
      errorMessage: null,
    });
  });

  it("maps a missing Replicate deployment to failed", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("not found", { status: 404 })
    );
    vi.stubGlobal("fetch", mockFetch);

    const snapshot = await refreshHostedDeploymentStatus({
      provider: "replicate",
      owner: "meta",
      name: "missing-deployment",
    });

    expect(snapshot).toEqual({
      status: "failed",
      externalWebUrl: "https://replicate.com/meta/missing-deployment",
      externalModelRef: null,
      errorMessage: "The hosted Replicate deployment no longer exists.",
    });
  });

  it("updates Replicate deployment scale for pause and resume actions", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          owner: "meta",
          name: "llama-3.3-70b-instruct",
          current_release: {
            model: "meta/llama-3.3-70b-instruct",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await updateHostedDeploymentScale({
      provider: "replicate",
      owner: "meta",
      name: "llama-3.3-70b-instruct",
      minInstances: 0,
      maxInstances: 0,
    });

    expect(result).toEqual({
      externalWebUrl: "https://replicate.com/meta/llama-3.3-70b-instruct",
      externalModelRef: "meta/llama-3.3-70b-instruct",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.replicate.com/v1/deployments/meta/llama-3.3-70b-instruct",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          min_instances: 0,
          max_instances: 0,
        }),
      })
    );
  });

  it("deletes a Replicate deployment after scaling it down", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            owner: "meta",
            name: "llama-3.3-70b-instruct",
            current_release: {
              model: "meta/llama-3.3-70b-instruct",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await deleteHostedDeployment({
      provider: "replicate",
      owner: "meta",
      name: "llama-3.3-70b-instruct",
    });

    expect(result).toEqual({
      deleted: true,
      externalWebUrl: "https://replicate.com/meta/llama-3.3-70b-instruct",
      remoteManaged: true,
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.replicate.com/v1/deployments/meta/llama-3.3-70b-instruct",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("treats Hugging Face hosted deployment removal as local cleanup only", async () => {
    const result = await deleteHostedDeployment({
      provider: "huggingface",
      owner: "Qwen",
      name: "Qwen2.5-7B-Instruct",
    });

    expect(result).toEqual({
      deleted: true,
      externalWebUrl: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
      remoteManaged: false,
    });
  });

  it("treats Hugging Face hosted inference as ready when inference is warm", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "Qwen/Qwen2.5-7B-Instruct",
          inference: "warm",
          pipeline_tag: "text-generation",
          disabled: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const snapshot = await refreshHostedDeploymentStatus({
      provider: "huggingface",
      owner: "Qwen",
      name: "Qwen2.5-7B-Instruct",
    });

    expect(snapshot).toEqual({
      status: "ready",
      externalWebUrl: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
      externalModelRef: "Qwen/Qwen2.5-7B-Instruct",
      errorMessage: null,
    });
  });

  it("runs a hosted Hugging Face deployment request", async () => {
    process.env.HUGGINGFACE_API_TOKEN = "hf-test-token";
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "Qwen/Qwen2.5-7B-Instruct",
            inference: "warm",
            pipeline_tag: "text-generation",
            disabled: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ generated_text: "Hello from Hugging Face" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", mockFetch);

    const response = await runHuggingFaceDeployment({
      modelRef: "Qwen/Qwen2.5-7B-Instruct",
      message: "Say hello",
    });

    expect(response.content).toBe("Hello from Hugging Face");
    expect(response.provider).toBe("huggingface");
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://api-inference.huggingface.co/models/Qwen%2FQwen2.5-7B-Instruct",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});

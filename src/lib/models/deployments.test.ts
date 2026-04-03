import { describe, expect, it } from "vitest";

import { buildDeploymentCatalog, hasUserVisibleDeploymentAccess } from "./deployments";

describe("buildDeploymentCatalog", () => {
  it("returns direct deployments plus clearly related pricing/provider options", () => {
    const result = buildDeploymentCatalog({
      model: {
        slug: "openai-o3",
        name: "o3",
        provider: "OpenAI",
        is_open_weights: false,
      },
      deployments: [
        {
          id: "dep-1",
          deploy_url: null,
          pricing_model: "per-token",
          price_per_unit: 10,
          unit_description: "M input tokens",
          free_tier: null,
          one_click: false,
          deployment_platforms: {
            id: "platform-openai",
            slug: "openai-api",
            name: "OpenAI API",
            type: "api",
            base_url: "https://platform.openai.com",
            has_affiliate: false,
            affiliate_url: null,
            affiliate_tag: null,
          },
        },
      ],
      platforms: [
        {
          id: "platform-openai",
          slug: "openai-api",
          name: "OpenAI API",
          type: "api",
          base_url: "https://platform.openai.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-openrouter",
          slug: "openrouter",
          name: "OpenRouter",
          type: "api",
          base_url: "https://openrouter.ai",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-chatgpt-plus",
          slug: "chatgpt-plus",
          name: "ChatGPT Plus",
          type: "subscription",
          base_url: "https://chat.openai.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-anthropic",
          slug: "anthropic-api",
          name: "Anthropic API",
          type: "api",
          base_url: "https://console.anthropic.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
      ],
      pricingProviderNames: ["OpenAI", "OpenRouter"],
    });

    expect(result.directDeployments).toHaveLength(1);
    expect(result.directDeployments[0]?.platform.slug).toBe("openai-api");
    expect(result.directDeployments[0]?.confidence).toBe("direct");

    expect(result.relatedPlatforms.map((item) => item.platform.slug)).toEqual(
      expect.arrayContaining(["openrouter", "chatgpt-plus"])
    );
    expect(result.relatedPlatforms.map((item) => item.platform.slug)).not.toContain("anthropic-api");
    expect(result.relatedPlatforms[0]?.reason.length).toBeGreaterThan(0);
    expect(result.relatedPlatforms[0]?.confidence).toMatch(/pricing_inferred|provider_family/);
  });

  it("uses clearer direct-deployment reasons for Ollama cloud entries", () => {
    const result = buildDeploymentCatalog({
      model: {
        slug: "minimax-minimax-m2-7",
        name: "MiniMax M2.7",
        provider: "MiniMax",
        is_open_weights: false,
      },
      deployments: [
        {
          id: "dep-1",
          deploy_url: "https://ollama.com/library/minimax-m2.7",
          pricing_model: null,
          price_per_unit: null,
          unit_description: "Cloud runtime",
          free_tier: null,
          one_click: true,
          deployment_platforms: {
            id: "platform-ollama-cloud",
            slug: "ollama-cloud",
            name: "Ollama Cloud",
            type: "hosting",
            base_url: "https://ollama.com/library",
            has_affiliate: false,
            affiliate_url: null,
            affiliate_tag: null,
          },
        },
      ],
      platforms: [],
      pricingProviderNames: [],
    });

    expect(result.directDeployments[0]?.reason).toBe(
      "Verified path to run this exact model on a cloud server you control."
    );
  });

  it("adds self-hosting options for open-weight models even without direct deployments", () => {
    const result = buildDeploymentCatalog({
      model: {
        slug: "google-gemma-3-27b",
        name: "Gemma 3 27B",
        provider: "Google",
        is_open_weights: true,
      },
      deployments: [],
      platforms: [
        {
          id: "platform-ollama",
          slug: "ollama",
          name: "Ollama",
          type: "local",
          base_url: "https://ollama.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-llamacpp",
          slug: "llamacpp",
          name: "llama.cpp",
          type: "local",
          base_url: "https://github.com/ggml-org/llama.cpp",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-chatgpt-plus",
          slug: "chatgpt-plus",
          name: "ChatGPT Plus",
          type: "subscription",
          base_url: "https://chat.openai.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
      ],
      pricingProviderNames: [],
    });

    expect(result.directDeployments).toHaveLength(0);
    expect(result.relatedPlatforms.map((item) => item.platform.slug)).toEqual(
      expect.arrayContaining(["ollama", "llamacpp"])
    );
    expect(result.relatedPlatforms.map((item) => item.platform.slug)).not.toContain("chatgpt-plus");
    expect(result.relatedPlatforms.every((item) => item.confidence === "open_weight_runtime")).toBe(true);
  });

  it("maps provider-family subscription plans for MiniMax, Kimi, and GLM providers", () => {
    const platforms = [
      {
        id: "platform-minimax",
        slug: "minimax-coding-plan",
        name: "MiniMax Coding Plan",
        type: "subscription",
        base_url: "https://www.minimax.io/pricing",
        has_affiliate: false,
        affiliate_url: null,
        affiliate_tag: null,
      },
      {
        id: "platform-kimi",
        slug: "kimi-code-membership",
        name: "Kimi Code Membership",
        type: "subscription",
        base_url: "https://www.kimi.com/code/docs/en/benefits.html",
        has_affiliate: false,
        affiliate_url: null,
        affiliate_tag: null,
      },
      {
        id: "platform-glm",
        slug: "glm-coding-plan",
        name: "GLM Coding Plan",
        type: "subscription",
        base_url: "https://docs.z.ai/devpack/overview",
        has_affiliate: false,
        affiliate_url: null,
        affiliate_tag: null,
      },
    ];

    const result = buildDeploymentCatalog({
      model: {
        slug: "z-ai-glm-5",
        name: "GLM-5",
        provider: "Z.ai",
        is_open_weights: false,
      },
      deployments: [],
      platforms,
      pricingProviderNames: [],
    });

    expect(result.relatedPlatforms.map((item) => item.platform.slug)).toContain("glm-coding-plan");

    const minimax = buildDeploymentCatalog({
      model: {
        slug: "minimax-minimax-m2-7",
        name: "MiniMax M2.7",
        provider: "MiniMax",
        is_open_weights: false,
      },
      deployments: [],
      platforms,
      pricingProviderNames: [],
    });

    expect(minimax.relatedPlatforms.map((item) => item.platform.slug)).toContain("minimax-coding-plan");

    const kimi = buildDeploymentCatalog({
      model: {
        slug: "moonshotai-kimi-k2",
        name: "Kimi K2",
        provider: "Moonshotai",
        is_open_weights: false,
      },
      deployments: [],
      platforms,
      pricingProviderNames: [],
    });

    expect(kimi.relatedPlatforms.map((item) => item.platform.slug)).toContain("kimi-code-membership");
  });

  it("does not suggest Gemini Advanced for open-weight Google models like Gemma", () => {
    const result = buildDeploymentCatalog({
      model: {
        slug: "google-gemma-4-31b-it",
        name: "Gemma 4 31B IT",
        provider: "Google",
        is_open_weights: true,
      },
      deployments: [],
      platforms: [
        {
          id: "platform-gemini-advanced",
          slug: "gemini-advanced",
          name: "Gemini Advanced",
          type: "subscription",
          base_url: "https://gemini.google.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-gcp-vertex",
          slug: "gcp-vertex",
          name: "GCP Vertex AI",
          type: "hosting",
          base_url: "https://cloud.google.com/vertex-ai",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
        {
          id: "platform-ollama",
          slug: "ollama",
          name: "Ollama",
          type: "local",
          base_url: "https://ollama.com",
          has_affiliate: false,
          affiliate_url: null,
          affiliate_tag: null,
        },
      ],
      pricingProviderNames: [],
    });

    expect(result.relatedPlatforms.map((item) => item.platform.slug)).toContain("gcp-vertex");
    expect(result.relatedPlatforms.map((item) => item.platform.slug)).toContain("ollama");
    expect(result.relatedPlatforms.map((item) => item.platform.slug)).not.toContain("gemini-advanced");

    const gcpVertex = result.relatedPlatforms.find((item) => item.platform.slug === "gcp-vertex");
    expect(gcpVertex?.reason).toMatch(/cloud-server path for private Gemma deployments/i);
  });
});

describe("hasUserVisibleDeploymentAccess", () => {
  it("treats provider-family subscriptions as user-visible access coverage", () => {
    expect(
      hasUserVisibleDeploymentAccess({
        provider: "MiniMax",
        is_open_weights: false,
        availablePlatformSlugs: ["minimax-coding-plan"],
      })
    ).toBe(true);
  });

  it("treats open-weight runtime platforms as user-visible access coverage", () => {
    expect(
      hasUserVisibleDeploymentAccess({
        provider: "Google",
        is_open_weights: true,
        availablePlatformSlugs: ["ollama"],
      })
    ).toBe(true);
  });

  it("requires a real path when neither provider-family nor open-weight access exists", () => {
    expect(
      hasUserVisibleDeploymentAccess({
        provider: "OpenRouter",
        is_open_weights: false,
        availablePlatformSlugs: ["anthropic-api"],
      })
    ).toBe(false);
  });

  it("does not treat Gemini Advanced as access coverage for open-weight Google models", () => {
    expect(
      hasUserVisibleDeploymentAccess({
        provider: "Google",
        is_open_weights: true,
        availablePlatformSlugs: ["gemini-advanced"],
      })
    ).toBe(false);
  });
});

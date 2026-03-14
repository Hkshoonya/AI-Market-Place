import { describe, expect, it } from "vitest";

import { buildDeploymentCatalog } from "./deployments";

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
});

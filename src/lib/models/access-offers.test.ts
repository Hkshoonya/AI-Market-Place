import { describe, expect, it } from "vitest";

import { buildAccessOffersCatalog, getBestAccessOfferForModel } from "./access-offers";

describe("buildAccessOffersCatalog", () => {
  it("ranks trusted affordable subscription offers above expensive weaker ones", () => {
    const result = buildAccessOffersCatalog({
      platforms: [
        {
          id: "chatgpt-plus",
          slug: "chatgpt-plus",
          name: "ChatGPT Plus",
          type: "subscription",
          base_url: "https://chat.openai.com",
          has_affiliate: false,
        },
        {
          id: "premium-ultra",
          slug: "premium-ultra",
          name: "Premium Ultra",
          type: "subscription",
          base_url: "https://example.com/ultra",
          has_affiliate: false,
        },
      ],
      deployments: [
        {
          id: "dep-1",
          model_id: "m1",
          platform_id: "chatgpt-plus",
          pricing_model: "monthly",
          price_per_unit: 20,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
        {
          id: "dep-2",
          model_id: "m2",
          platform_id: "chatgpt-plus",
          pricing_model: "monthly",
          price_per_unit: 20,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
        {
          id: "dep-3",
          model_id: "m3",
          platform_id: "premium-ultra",
          pricing_model: "monthly",
          price_per_unit: 200,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
      ],
      models: [
        {
          id: "m1",
          slug: "openai-gpt-4o",
          name: "GPT-4o",
          provider: "OpenAI",
          category: "llm",
          capability_score: 88,
          economic_footprint_score: 84,
        },
        {
          id: "m2",
          slug: "openai-o3",
          name: "o3",
          provider: "OpenAI",
          category: "multimodal",
          capability_score: 90,
          economic_footprint_score: 82,
        },
        {
          id: "m3",
          slug: "ultra-basic",
          name: "Ultra Basic",
          provider: "Example AI",
          category: "llm",
          capability_score: 60,
          economic_footprint_score: 48,
        },
      ],
    });

    expect(result.subscriptionOffers).toHaveLength(2);
    expect(result.subscriptionOffers[0]?.platform.slug).toBe("chatgpt-plus");
    expect(result.subscriptionOffers[0]?.label).toBe("Official");
    expect(result.subscriptionOffers[0]?.actionLabel).toBe("Subscribe");
    expect(result.subscriptionOffers[0]?.bestFor).toContain("general chat");
  });

  it("keeps partner-supported disclosure separate from the main CTA", () => {
    const result = buildAccessOffersCatalog({
      platforms: [
        {
          id: "perplexity-pro",
          slug: "perplexity-pro",
          name: "Perplexity Pro",
          type: "subscription",
          base_url: "https://perplexity.ai",
          has_affiliate: true,
          affiliate_url: "https://perplexity.ai/?ref=aimarketcap",
        },
      ],
      deployments: [
        {
          id: "dep-1",
          model_id: "m1",
          platform_id: "perplexity-pro",
          pricing_model: "monthly",
          price_per_unit: 20,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
      ],
      models: [
        {
          id: "m1",
          slug: "perplexity-sonar",
          name: "Perplexity Sonar",
          provider: "Perplexity",
          category: "llm",
          capability_score: 72,
          economic_footprint_score: 68,
        },
      ],
    });

    expect(result.subscriptionOffers[0]?.actionLabel).toBe("Subscribe");
    expect(result.subscriptionOffers[0]?.actionUrl).toBe("https://perplexity.ai/?ref=aimarketcap");
    expect(result.subscriptionOffers[0]?.partnerDisclosure).toBe("Partner-supported link");
  });

  it("uses trial-aware and api-aware CTA labels", () => {
    const result = buildAccessOffersCatalog({
      platforms: [
        {
          id: "claude-pro",
          slug: "claude-pro",
          name: "Claude Pro",
          type: "subscription",
          base_url: "https://claude.ai",
          has_affiliate: false,
        },
        {
          id: "minimax-api",
          slug: "minimax-api",
          name: "MiniMax API",
          type: "api",
          base_url: "https://www.minimax.io",
          has_affiliate: false,
        },
      ],
      deployments: [
        {
          id: "dep-1",
          model_id: "m1",
          platform_id: "claude-pro",
          pricing_model: "monthly",
          price_per_unit: 20,
          unit_description: "month",
          free_tier: "7-day trial",
          one_click: false,
          status: "available",
        },
        {
          id: "dep-2",
          model_id: "m2",
          platform_id: "minimax-api",
          pricing_model: "monthly",
          price_per_unit: 15,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
      ],
      models: [
        {
          id: "m1",
          slug: "claude-3-7-sonnet",
          name: "Claude 3.7 Sonnet",
          provider: "Anthropic",
          category: "llm",
          capability_score: 84,
          economic_footprint_score: 71,
        },
        {
          id: "m2",
          slug: "minimax-m1",
          name: "MiniMax M1",
          provider: "MiniMax",
          category: "llm",
          capability_score: 79,
          economic_footprint_score: 65,
        },
      ],
    });

    const bySlug = new Map(result.subscriptionOffers.map((offer) => [offer.platform.slug, offer]));

    expect(bySlug.get("claude-pro")?.actionLabel).toBe("Start Free Trial");
    expect(bySlug.get("minimax-api")?.actionLabel).toBe("Get API Access");
    expect(bySlug.get("minimax-api")?.label).toBe("Verified");
  });

  it("surfaces verified subscription plans even when public monthly pricing is unknown", () => {
    const result = buildAccessOffersCatalog({
      platforms: [
        {
          id: "kimi-code-membership",
          slug: "kimi-code-membership",
          name: "Kimi Code Membership",
          type: "subscription",
          base_url: "https://www.kimi.com/code/docs/en/benefits.html",
          has_affiliate: false,
        },
      ],
      deployments: [
        {
          id: "dep-1",
          model_id: "m1",
          platform_id: "kimi-code-membership",
          pricing_model: "monthly",
          price_per_unit: null,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
      ],
      models: [
        {
          id: "m1",
          slug: "moonshotai-kimi-k2",
          name: "Kimi K2",
          provider: "Moonshotai",
          category: "coding",
          capability_score: 81,
          economic_footprint_score: 69,
        },
      ],
    });

    expect(result.subscriptionOffers).toHaveLength(1);
    expect(result.subscriptionOffers[0]?.platform.slug).toBe("kimi-code-membership");
    expect(result.subscriptionOffers[0]?.monthlyPrice).toBeNull();
    expect(result.subscriptionOffers[0]?.monthlyPriceLabel).toBe("Custom");
    expect(result.subscriptionOffers[0]?.actionLabel).toBe("Subscribe");
  });

  it("exposes best access offers per model across subscription and deployment routes", () => {
    const result = buildAccessOffersCatalog({
      platforms: [
        {
          id: "chatgpt-plus",
          slug: "chatgpt-plus",
          name: "ChatGPT Plus",
          type: "subscription",
          base_url: "https://chat.openai.com",
          has_affiliate: false,
        },
        {
          id: "runpod",
          slug: "runpod",
          name: "RunPod",
          type: "hosting",
          base_url: "https://runpod.io",
          has_affiliate: true,
          affiliate_url: "https://runpod.io/?ref=aimarketcap",
        },
      ],
      deployments: [
        {
          id: "dep-1",
          model_id: "m1",
          platform_id: "chatgpt-plus",
          pricing_model: "monthly",
          price_per_unit: 20,
          unit_description: "month",
          free_tier: null,
          one_click: false,
          status: "available",
        },
        {
          id: "dep-2",
          model_id: "m1",
          platform_id: "runpod",
          pricing_model: "per-hour",
          price_per_unit: 1.2,
          unit_description: "hour",
          free_tier: null,
          one_click: true,
          status: "available",
        },
        {
          id: "dep-3",
          model_id: "m2",
          platform_id: "runpod",
          pricing_model: "per-hour",
          price_per_unit: 0.8,
          unit_description: "hour",
          free_tier: "Starter credit",
          one_click: true,
          status: "available",
        },
      ],
      models: [
        {
          id: "m1",
          slug: "openai-gpt-4o",
          name: "GPT-4o",
          provider: "OpenAI",
          category: "llm",
          capability_score: 88,
          economic_footprint_score: 84,
        },
        {
          id: "m2",
          slug: "deepseek-r1",
          name: "DeepSeek R1",
          provider: "DeepSeek",
          category: "llm",
          capability_score: 81,
          economic_footprint_score: 67,
        },
      ],
    });

    expect(getBestAccessOfferForModel(result, "m1")).toMatchObject({
      platform: { slug: "chatgpt-plus" },
      actionLabel: "Subscribe",
      label: "Official",
    });

    expect(getBestAccessOfferForModel(result, "m2")).toMatchObject({
      platform: { slug: "runpod" },
      actionLabel: "Start Free Trial",
      partnerDisclosure: "Partner-supported link",
    });
  });
});

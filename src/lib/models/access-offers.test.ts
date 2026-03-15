import { describe, expect, it } from "vitest";

import { buildAccessOffersCatalog } from "./access-offers";

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
});


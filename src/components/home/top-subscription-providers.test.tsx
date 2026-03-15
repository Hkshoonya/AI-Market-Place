import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopSubscriptionProviders } from "./top-subscription-providers";

describe("TopSubscriptionProviders", () => {
  it("renders ranked offers with action-first labels and partner disclosure", () => {
    render(
      <TopSubscriptionProviders
        offers={[
          {
            platform: {
              id: "chatgpt-plus",
              slug: "chatgpt-plus",
              name: "ChatGPT Plus",
              type: "subscription",
              base_url: "https://chat.openai.com",
              has_affiliate: false,
            },
            kind: "subscription",
            label: "Official",
            actionLabel: "Subscribe",
            actionUrl: "https://chat.openai.com",
            partnerDisclosure: null,
            monthlyPrice: 20,
            monthlyPriceLabel: "$20/mo",
            score: 91,
            userValueScore: 90,
            trustScore: 100,
            affordabilityScore: 100,
            utilityBreadthScore: 62,
            modelCount: 12,
            categoryCount: 2,
            bestFor: "general chat, reasoning, and writing",
            topModels: [
              { slug: "openai-gpt-4o", name: "GPT-4o", provider: "OpenAI" },
            ],
            freeTier: null,
          },
          {
            platform: {
              id: "perplexity-pro",
              slug: "perplexity-pro",
              name: "Perplexity Pro",
              type: "subscription",
              base_url: "https://perplexity.ai",
              has_affiliate: true,
            },
            kind: "subscription",
            label: "Official",
            actionLabel: "Subscribe",
            actionUrl: "https://perplexity.ai/?ref=aimarketcap",
            partnerDisclosure: "Partner-supported link",
            monthlyPrice: 20,
            monthlyPriceLabel: "$20/mo",
            score: 78,
            userValueScore: 74,
            trustScore: 90,
            affordabilityScore: 100,
            utilityBreadthScore: 40,
            modelCount: 5,
            categoryCount: 1,
            bestFor: "general chat, reasoning, and writing",
            topModels: [
              { slug: "perplexity-sonar", name: "Perplexity Sonar", provider: "Perplexity" },
            ],
            freeTier: null,
          },
        ]}
      />
    );

    expect(screen.getByText("Top Subscription Providers")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Subscribe/i })).toHaveLength(2);
    expect(screen.getByText("Partner-supported link")).toBeInTheDocument();
    expect(screen.getAllByText("$20/mo")).toHaveLength(2);
    expect(screen.getByText("ChatGPT Plus")).toBeInTheDocument();
  });
});

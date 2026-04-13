import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelsGrid } from "./models-grid";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/constants/categories", () => ({
  CATEGORIES: [
    {
      slug: "llm",
      shortLabel: "LLM",
      color: "#00ff00",
      icon: () => <svg data-testid="category-icon" />,
    },
  ],
}));

vi.mock("@/lib/format", () => ({
  formatNumber: (value: number | null | undefined) => String(value ?? 0),
}));

vi.mock("@/lib/models/lifecycle", () => ({
  getLifecycleBadge: (status: string) =>
    status === "experimental"
      ? { label: "Experimental", rankedByDefault: false }
      : null,
}));

vi.mock("@/lib/models/pricing", () => ({
  getPublicPricingSummary: () => ({
    compactDisplay: "$0.40 / 1M tokens",
    compactLabel: "API access",
  }),
}));

vi.mock("@/lib/models/presentation", () => ({
  getParameterDisplay: () => ({
    label: "31B",
  }),
}));

vi.mock("@/lib/models/market-value", () => ({
  formatMarketValue: (value: number | null) => (value ? `$${value}` : "—"),
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => (
    <span data-testid={`provider-${provider}`}>{provider}</span>
  ),
}));

vi.mock("@/components/models/model-signal-badge", () => ({
  ModelSignalBadge: () => <div>Recent signal</div>,
}));

describe("ModelsGrid", () => {
  it("shows guided setup for managed models and runtime labels for self-serve ones", () => {
    render(
      <ModelsGrid
        models={[
          {
            id: "model-managed",
            slug: "kimi-k2",
            name: "Kimi K2",
            provider: "Moonshot",
            category: "llm",
            status: "active",
            overall_rank: 1,
            quality_score: 92.4,
            market_cap_estimate: 1200000,
            is_open_weights: false,
            parameter_count: 31_000_000_000,
            hf_downloads: 4200,
            model_pricing: [],
            recent_signal: {
              headline: "Provider expanded availability",
              signal_type: "release",
              importance: "medium",
              published_at: "2026-04-13T00:00:00Z",
            },
            access_offer: {
              monthlyPriceLabel: "$20/mo",
              actionLabel: "Subscription",
            },
            managed_deployment_available: true,
            usage_mode_labels: null,
            self_host_requirement_label: null,
          },
          {
            id: "model-open",
            slug: "gemma-4-27b",
            name: "Gemma 4 27B",
            provider: "Google",
            category: "llm",
            status: "experimental",
            overall_rank: 7,
            quality_score: 88.1,
            market_cap_estimate: null,
            is_open_weights: true,
            parameter_count: 27_000_000_000,
            hf_downloads: 1700,
            model_pricing: [],
            recent_signal: null,
            access_offer: null,
            managed_deployment_available: false,
            usage_mode_labels: ["Ready to Use", "Cloud server you control"],
            self_host_requirement_label: "24GB+ GPU memory",
          },
        ]}
      />
    );

    expect(screen.getByText("Guided setup here")).toBeInTheDocument();
    expect(screen.getByText("Recent signal")).toBeInTheDocument();
    expect(screen.getByText("$20/mo")).toBeInTheDocument();
    expect(screen.getByText("Subscription")).toBeInTheDocument();
    expect(screen.getByText("Ready to Use")).toBeInTheDocument();
    expect(screen.getByText("Cloud server you control")).toBeInTheDocument();
    expect(screen.getByText("24GB+ GPU memory")).toBeInTheDocument();
    expect(screen.getByText("Experimental")).toBeInTheDocument();
    expect(screen.getByText("Open Weights")).toBeInTheDocument();
    expect(screen.getByText("Proprietary")).toBeInTheDocument();
  });
});

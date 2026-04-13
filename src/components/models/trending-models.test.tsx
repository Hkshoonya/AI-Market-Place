import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrendingModels } from "./trending-models";

const mockUseSWR = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/lib/swr/config", () => ({
  SWR_TIERS: {
    MEDIUM: {},
  },
}));

vi.mock("@/lib/format", () => ({
  formatNumber: (value: number | null | undefined) => String(value ?? 0),
}));

vi.mock("@/lib/models/deployability", () => ({
  getDeployabilityLabel: () => "Managed runtime",
}));

vi.mock("@/lib/models/presentation", () => ({
  getParameterDisplay: () => ({
    label: "31B",
  }),
}));

vi.mock("@/lib/constants/categories", () => ({
  CATEGORY_MAP: {
    llm: {
      shortLabel: "LLM",
      color: "#00ff00",
    },
  },
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => (
    <span data-testid={`provider-${provider}`}>{provider}</span>
  ),
}));

vi.mock("@/components/models/model-signal-badge", () => ({
  ModelSignalBadge: () => <div>Recent signal</div>,
}));

describe("TrendingModels", () => {
  it("keeps the ways-to-use explainer and deployable labels visible", async () => {
    const user = userEvent.setup();

    mockUseSWR.mockReturnValue({
      data: {
        trending: [],
        recent: [],
        deployable: [
          {
            id: "model-1",
            slug: "kimi-k2",
            name: "Kimi K2",
            provider: "Moonshot",
            category: "llm",
            overall_rank: 1,
            quality_score: 92.4,
            hf_downloads: 4200,
            parameter_count: 31_000_000_000,
            is_open_weights: false,
            release_date: "2026-04-01T00:00:00Z",
            recent_signal: {
              headline: "New provider access path",
              signal_type: "release",
              importance: "medium",
              published_at: "2026-04-13T00:00:00Z",
            },
          },
        ],
        popular: [],
        discussed: [],
      },
      isLoading: false,
    });

    render(<TrendingModels />);

    expect(screen.getByText((_, element) => {
      return (
        element?.tagName.toLowerCase() === "p" &&
        element.textContent?.includes("Ways to Use") &&
        element.textContent?.includes("just became easier to access")
      ) ?? false;
    })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show Ways to Use models/i }));

    expect(screen.getByRole("link", { name: /Kimi K2/i })).toHaveAttribute("href", "/models/kimi-k2");
    expect(screen.getByText("Managed runtime")).toBeInTheDocument();
    expect(screen.getByText("Recent signal")).toBeInTheDocument();
  });
});

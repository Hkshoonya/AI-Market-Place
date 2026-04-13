import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelOverview } from "./model-overview";

const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/lib/swr/config", () => ({
  SWR_TIERS: {
    SLOW: {},
  },
}));

describe("ModelOverview", () => {
  it("renders overview details, evidence badges, and methodology", () => {
    mockUseSWR.mockReturnValue({
      data: {
        summary: "Strong coding model with lower latency.",
        highlights: [
          { label: "Latency", value: "Fast", tone: "verified" },
          { label: "Price", value: "Lower cost", tone: "estimated" },
        ],
        pros: [
          {
            title: "Good for coding",
            description: "Performs well on structured development tasks.",
            source: "benchmarks",
          },
        ],
        cons: [
          {
            title: "Weaker long context",
            description: "Quality drops on very large prompts.",
            source: "reviews",
          },
        ],
        best_for: ["IDE copilots"],
        not_ideal_for: ["Long research agents"],
        evidence_badges: ["Benchmark-backed", "Recent provider update"],
        methodology: {
          hiddenByDefault: true,
          summary: "Synthesized from benchmark data and provider disclosures.",
          sourceLabels: ["Benchmarks", "Provider"],
          confidenceLabel: "High",
        },
        comparison_notes: null,
        generated_by: "editorial",
        upvotes: 42,
        downvotes: 3,
      },
      error: null,
      isLoading: false,
    });

    render(<ModelOverview modelSlug="kimi-k2" />);

    expect(screen.getByText("Strong coding model with lower latency.")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("Fast")).toBeInTheDocument();
    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.getByText("Good for coding")).toBeInTheDocument();
    expect(screen.getByText("Limitations")).toBeInTheDocument();
    expect(screen.getByText("Weaker long context")).toBeInTheDocument();
    expect(screen.getByText("Best for:")).toBeInTheDocument();
    expect(screen.getByText("IDE copilots")).toBeInTheDocument();
    expect(screen.getByText("Not ideal for:")).toBeInTheDocument();
    expect(screen.getByText("Long research agents")).toBeInTheDocument();
    expect(screen.getByText("Source: editorial")).toBeInTheDocument();
    expect(screen.getByText("Benchmark-backed")).toBeInTheDocument();
    expect(screen.getByText("Recent provider update")).toBeInTheDocument();
    expect(screen.getByText("Methodology / Sources")).toBeInTheDocument();
    expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText(/Evidence classes: Benchmarks, Provider/i)).toBeInTheDocument();
  });

  it("renders the error state when the description request fails", () => {
    mockUseSWR.mockReturnValue({
      data: null,
      error: new Error("Overview unavailable"),
      isLoading: false,
    });

    render(<ModelOverview modelSlug="kimi-k2" />);

    expect(screen.getByText("Overview unavailable")).toBeInTheDocument();
  });
});

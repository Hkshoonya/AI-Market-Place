import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SimilarModels } from "./similar-models";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/models/presentation", () => ({
  getParameterDisplay: () => ({ label: "70B" }),
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => (
    <span>{provider}</span>
  ),
}));

describe("SimilarModels", () => {
  it("renders similar-model links and the category view-all path", () => {
    render(
      <SimilarModels
        currentCategory="llm"
        models={[
          {
            id: "model_1",
            slug: "llama-3-3-70b",
            name: "Llama 3.3 70B",
            provider: "Meta",
            category: "llm",
            overall_rank: 4,
            quality_score: 91.2,
            hf_downloads: 2500,
            parameter_count: 70_000_000_000,
            is_open_weights: true,
          },
        ]}
      />
    );

    expect(screen.getByText("Similar Models")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View All/i })).toHaveAttribute(
      "href",
      "/models?category=llm"
    );
    expect(screen.getByRole("link", { name: /Llama 3.3 70B/i })).toHaveAttribute(
      "href",
      "/models/llama-3-3-70b"
    );
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("70B")).toBeInTheDocument();
    expect(screen.getByText("91.2")).toBeInTheDocument();
    expect(screen.getByTitle("Open Weights")).toBeInTheDocument();
  });

  it("returns nothing when there are no similar models", () => {
    const { container } = render(<SimilarModels currentCategory="llm" models={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

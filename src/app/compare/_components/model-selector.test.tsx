import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelSelector } from "./model-selector";

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => <span>{provider}</span>,
}));

describe("ModelSelector", () => {
  it("filters out selected models and selects a searched model", () => {
    const onSelect = vi.fn();

    render(
      <ModelSelector
        allModels={[
          {
            id: "1",
            slug: "alpha",
            name: "Alpha",
            provider: "OpenAI",
            category: "llm",
          },
          {
            id: "2",
            slug: "beta",
            name: "Beta Vision",
            provider: "Anthropic",
            category: "multimodal",
          },
        ]}
        selectedSlugs={["alpha"]}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add model/i }));

    const searchInput = screen.getByPlaceholderText("Search models...");
    fireEvent.change(searchInput, { target: { value: "beta" } });

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Vision")).toBeInTheDocument();
    expect(screen.getByText("Multimodal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /beta vision/i }));

    expect(onSelect).toHaveBeenCalledWith("beta");
    expect(screen.queryByPlaceholderText("Search models...")).not.toBeInTheDocument();
  });

  it("shows an empty state when no models match the search", () => {
    render(
      <ModelSelector
        allModels={[
          {
            id: "1",
            slug: "alpha",
            name: "Alpha",
            provider: "OpenAI",
            category: "llm",
          },
        ]}
        selectedSlugs={[]}
        onSelect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add model/i }));
    fireEvent.change(screen.getByPlaceholderText("Search models..."), {
      target: { value: "missing" },
    });

    expect(screen.getByText("No models found")).toBeInTheDocument();
  });
});

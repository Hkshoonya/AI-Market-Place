import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewsTab } from "./news-tab";

vi.mock("@/components/news/news-card", () => ({
  NewsCard: ({ item }: { item: { title?: string } }) => <div>{item.title}</div>,
}));

vi.mock("@/components/news/launch-radar", () => ({
  LaunchRadar: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/news/signal-summary", () => ({
  SignalSummary: () => <div>Signal summary</div>,
}));

vi.mock("@/lib/news/presentation", () => ({
  summarizeNewsSignals: () => [{ label: "Launch", count: 1 }],
  buildLaunchRadar: () => [{ id: "radar-1" }],
}));

describe("NewsTab", () => {
  it("groups news into source sections", () => {
    render(
      <NewsTab
        modelNews={[
          { id: "1", title: "Provider blog update", source: "provider-blog" },
          { id: "2", title: "Arena ranking moved", source: "artificial-analysis" },
          { id: "3", title: "New paper", source: "arxiv" },
          { id: "4", title: "Misc coverage", source: "news-site" },
        ]}
      />
    );

    expect(screen.getByText("Signal summary")).toBeInTheDocument();
    expect(screen.getByText("What Changed Recently")).toBeInTheDocument();
    expect(screen.getByText("Social & Blog Posts")).toBeInTheDocument();
    expect(screen.getByText("Benchmarks & Rankings")).toBeInTheDocument();
    expect(screen.getByText("Research Papers")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText("Provider blog update")).toBeInTheDocument();
    expect(screen.getByText("Arena ranking moved")).toBeInTheDocument();
    expect(screen.getByText("New paper")).toBeInTheDocument();
    expect(screen.getByText("Misc coverage")).toBeInTheDocument();
  });

  it("renders the empty state when there is no linked news", () => {
    render(<NewsTab modelNews={[]} />);

    expect(
      screen.getByText("No news linked to this model yet. News is automatically linked during data sync.")
    ).toBeInTheDocument();
  });
});

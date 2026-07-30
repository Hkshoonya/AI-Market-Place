import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroSection } from "./hero-section";

vi.mock("@/components/three/neural-network-scene", () => ({
  NeuralNetworkScene: () => <div data-testid="neural-network-scene" />,
}));

describe("HeroSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts the neural network scene alongside hero content", () => {
    render(
      <HeroSection
        stats={{
          modelCount: 1331,
          categoryCount: 12,
          providerCount: 28,
          benchmarkCount: 41,
          totalDownloads: 4_200_000,
          totalLikes: 91_000,
        }}
        marketSignalsRelative="15m ago"
        marketSignalsAbsolute="May 7, 2026"
        marketSignalsDetail="pipeline sync"
      />
    );

    expect(screen.getByTestId("hero-scene-slot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /market cap/i })).toBeInTheDocument();
    expect(
      screen.getByText(/structured benchmarks where available, provider-reported evidence, pricing intelligence, and a marketplace/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search models, providers, or releases/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/market signals refreshed 15m ago/i)).toBeInTheDocument();
    expect(screen.getByText(/pipeline sync/i)).toBeInTheDocument();
  });
});

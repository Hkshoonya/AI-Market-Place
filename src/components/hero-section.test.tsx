import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroSection } from "./hero-section";

vi.mock("@/components/three/neural-network-scene", () => ({
  NeuralNetworkScene: () => <div data-testid="neural-network-scene" />,
}));

describe("HeroSection", () => {
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
      />
    );

    expect(screen.getByTestId("hero-scene-slot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /market cap/i })).toBeInTheDocument();
    expect(
      screen.getByText(/structured benchmarks where available, provider-reported evidence, pricing intelligence, and a marketplace/i)
    ).toBeInTheDocument();
  });
});

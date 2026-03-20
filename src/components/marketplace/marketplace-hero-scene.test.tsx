import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceHeroScene } from "./marketplace-hero-scene";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="marketplace-hero-canvas" />,
  useFrame: vi.fn(),
}));

describe("MarketplaceHeroScene", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders a marketplace hero scene container", () => {
    render(<MarketplaceHeroScene />);

    expect(screen.getByTestId("marketplace-hero-scene")).toBeInTheDocument();
    expect(screen.getByTestId("marketplace-hero-canvas")).toBeInTheDocument();
  });
});

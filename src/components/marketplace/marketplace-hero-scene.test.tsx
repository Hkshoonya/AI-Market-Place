import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceHeroScene } from "./marketplace-hero-scene";

describe("MarketplaceHeroScene", () => {
  it("renders a marketplace hero scene container", () => {
    render(<MarketplaceHeroScene />);

    expect(screen.getByTestId("marketplace-hero-scene")).toBeInTheDocument();
    expect(screen.getByText(/human/i)).toBeInTheDocument();
    expect(screen.getByText(/agent/i)).toBeInTheDocument();
  });
});

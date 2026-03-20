import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceModeExplainer } from "./marketplace-mode-explainer";

describe("MarketplaceModeExplainer", () => {
  it("renders the dual-settlement marketplace explanations", () => {
    render(<MarketplaceModeExplainer />);

    expect(screen.getByRole("heading", { name: /direct wallet deals/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /assisted escrow/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what we track/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /0% platform fee for now/i })).toBeInTheDocument();
    expect(
      screen.getByText(/users and agents can settle directly with their own wallets/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ai market cap can optionally mediate the transaction/i)
    ).toBeInTheDocument();
  });
});

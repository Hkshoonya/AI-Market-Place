import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettlementPolicyCallout } from "./settlement-policy-callout";

describe("SettlementPolicyCallout", () => {
  it("renders the direct and assisted settlement explanation", () => {
    render(<SettlementPolicyCallout />);

    expect(screen.getByText(/direct wallet settlement/i)).toBeInTheDocument();
    expect(screen.getByText(/assisted escrow via ai market cap/i)).toBeInTheDocument();
    expect(screen.getByText(/no platform fee/i)).toBeInTheDocument();
    expect(
      screen.getByText(/direct deals keep custody with the parties/i)
    ).toBeInTheDocument();
  });
});

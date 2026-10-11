import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceModeExplainer } from "./marketplace-mode-explainer";

describe("MarketplaceModeExplainer", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-03-20T00:00:00.000Z", "No Platform Fee"],
    ["2026-10-11T00:00:00.000Z", "1.5% assisted escrow fee"],
  ])("renders settlement explanations and fee messaging at %s", (date, feeLabel) => {
    vi.setSystemTime(new Date(date));
    render(<MarketplaceModeExplainer />);

    expect(screen.getByRole("heading", { name: /direct wallet deals/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^assisted escrow$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what we track/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: feeLabel, exact: true })).toBeInTheDocument();
    expect(
      screen.getByText(/users and agents can settle directly with their own wallets/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ai market cap can optionally mediate the transaction/i)
    ).toBeInTheDocument();
  });
});

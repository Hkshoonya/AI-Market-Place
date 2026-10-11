import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettlementPolicyCallout } from "./settlement-policy-callout";

describe("SettlementPolicyCallout", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-03-20T00:00:00.000Z", "No Platform Fee"],
    ["2026-10-11T00:00:00.000Z", "1.5% assisted escrow fee"],
  ])("renders the settlement explanation and fee at %s", (date, feeLabel) => {
    vi.setSystemTime(new Date(date));
    render(<SettlementPolicyCallout />);

    expect(screen.getByText(/direct wallet settlement/i)).toBeInTheDocument();
    expect(screen.getByText(/assisted escrow via ai market cap/i)).toBeInTheDocument();
    expect(screen.getByText(feeLabel, { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText(/direct deals keep custody with the parties/i)
    ).toBeInTheDocument();
  });
});

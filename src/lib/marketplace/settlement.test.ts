import { describe, expect, it } from "vitest";

import {
  ESCROW_PLATFORM_FEE_BPS,
  FIRST_ESCROW_FEE_WAIVER_MONTHS,
  getMarketplaceFeeHeadline,
  getSettlementModeOptions,
  getSettlementModeSummary,
  isEscrowFeeWaived,
} from "./settlement";

describe("marketplace settlement helpers", () => {
  it("returns the direct settlement mode as the default recommendation", () => {
    const options = getSettlementModeOptions();

    expect(options[0]).toMatchObject({
      key: "direct",
      isDefault: true,
      feeLabel: "No Platform Fee",
    });
    expect(options[1]).toMatchObject({
      key: "assisted_escrow",
      feeLabel: "No Platform Fee",
    });
  });

  it("keeps assisted escrow messaging simple while preserving future fee configuration", () => {
    expect(ESCROW_PLATFORM_FEE_BPS).toBe(150);
    expect(FIRST_ESCROW_FEE_WAIVER_MONTHS).toBe(6);
    expect(getMarketplaceFeeHeadline()).toBe("No Platform Fee");
  });

  it("treats escrow as fee-waived during the initial launch window", () => {
    expect(isEscrowFeeWaived(new Date("2026-03-20T00:00:00.000Z"))).toBe(true);
  });

  it("surfaces direct and escrow summaries for marketplace explanations", () => {
    expect(getSettlementModeSummary("direct")).toMatchObject({
      title: "Direct Wallet Deals",
      tracksOnPlatform: true,
      usesPlatformEscrow: false,
    });
    expect(getSettlementModeSummary("assisted_escrow")).toMatchObject({
      title: "Assisted Escrow",
      tracksOnPlatform: true,
      usesPlatformEscrow: true,
    });
  });
});

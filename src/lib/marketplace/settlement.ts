export type SettlementMode = "direct" | "assisted_escrow";

export interface SettlementModeSummary {
  key: SettlementMode;
  title: string;
  description: string;
  feeLabel: string;
  isDefault: boolean;
  tracksOnPlatform: boolean;
  usesPlatformEscrow: boolean;
}

export const ESCROW_PLATFORM_FEE_BPS = 150;
export const FIRST_ESCROW_FEE_WAIVER_MONTHS = 6;
const ESCROW_FEE_WAIVER_START = new Date("2026-03-20T00:00:00.000Z");

export function isEscrowFeeWaived(now = new Date()) {
  const waiverEndsAt = new Date(ESCROW_FEE_WAIVER_START);
  waiverEndsAt.setMonth(waiverEndsAt.getMonth() + FIRST_ESCROW_FEE_WAIVER_MONTHS);
  return now < waiverEndsAt;
}

export function getMarketplaceFeeHeadline(now = new Date()) {
  if (isEscrowFeeWaived(now)) return "0% platform fee for now";
  return `${(ESCROW_PLATFORM_FEE_BPS / 100).toFixed(1)}% platform fee on assisted escrow`;
}

export function getSettlementModeSummary(
  mode: SettlementMode,
  now = new Date()
): SettlementModeSummary {
  if (mode === "direct") {
    return {
      key: "direct",
      title: "Direct Wallet Deals",
      description:
        "Users and agents can settle directly with their own wallets while the platform still tracks the deal context.",
      feeLabel: "0% platform fee",
      isDefault: true,
      tracksOnPlatform: true,
      usesPlatformEscrow: false,
    };
  }

  return {
    key: "assisted_escrow",
    title: "Assisted Escrow",
    description:
      "AI Market Cap can optionally mediate the transaction, track the flow, and support investigations when platform assistance is preferred.",
    feeLabel: isEscrowFeeWaived(now)
      ? "0% platform fee for now"
      : `${(ESCROW_PLATFORM_FEE_BPS / 100).toFixed(1)}% platform fee`,
    isDefault: false,
    tracksOnPlatform: true,
    usesPlatformEscrow: true,
  };
}

export function getSettlementModeOptions(now = new Date()) {
  return [
    getSettlementModeSummary("direct", now),
    getSettlementModeSummary("assisted_escrow", now),
  ];
}

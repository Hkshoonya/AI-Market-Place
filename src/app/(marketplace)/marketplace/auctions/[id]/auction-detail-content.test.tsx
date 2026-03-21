import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ImgHTMLAttributes, type ReactNode } from "react";
import AuctionDetailContent from "./auction-detail-content";

const mockUseSWR = vi.fn();
const mockUseAuth = vi.fn();
const mockUseWalletBalance = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/use-wallet-balance", () => ({
  useWalletBalance: (args: unknown) => mockUseWalletBalance(args),
}));

vi.mock("@/hooks/use-auction-timer", () => ({
  useAuctionTimer: () => ({
    timeRemaining: "1h 32m",
    dutchPrice: 125,
  }),
}));

vi.mock("@/components/marketplace/bid-history-table", () => ({
  BidHistoryTable: () => <div data-testid="bid-history-table" />,
}));

vi.mock("@/components/marketplace/english-bid-panel", () => ({
  EnglishBidPanel: () => <div data-testid="english-bid-panel" />,
}));

vi.mock("@/components/marketplace/dutch-bid-panel", () => ({
  DutchBidPanel: () => <div data-testid="dutch-bid-panel" />,
}));

const auction = {
  id: "auction-1",
  listing_id: "listing-1",
  auction_type: "english" as const,
  status: "active" as const,
  start_price: 100,
  current_price: 125,
  floor_price: null,
  reserve_price: null,
  price_decrement: null,
  decrement_interval_seconds: null,
  bid_increment: 5,
  bid_count: 3,
  auto_extend_minutes: 5,
  starts_at: "2026-03-21T00:00:00.000Z",
  ends_at: "2026-03-22T00:00:00.000Z",
  created_at: "2026-03-20T00:00:00.000Z",
  winner_id: null,
  listing: {
    id: "listing-1",
    title: "Agent Protocol Kit",
    slug: "agent-protocol-kit",
    listing_type: "agent",
  },
  seller: {
    id: "seller-1",
    display_name: "Protocol Seller",
    username: "protocol-seller",
    seller_verified: true,
    seller_rating: 4.9,
    total_sales: 12,
  },
  bids: [],
};

describe("AuctionDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseSWR.mockReturnValue({
      data: auction,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
    });

    mockUseWalletBalance.mockReturnValue({
      walletData: {
        balance: 412.55,
        solana_deposit_address: "So1anaAddress123",
        evm_deposit_address: "0xabc123",
      },
      loadingWallet: false,
      refetch: vi.fn(),
    });
  });

  it("shows the signed-in bidder's real wallet balance instead of placeholder copy", () => {
    render(<AuctionDetailContent auctionId="auction-1" />);

    expect(screen.getByText(/your wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/\$412\.55/)).toBeInTheDocument();
    expect(screen.getByText(/ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/connect wallet to view balance/i)).not.toBeInTheDocument();
  });

  it("shows funding guidance when the signed-in bidder balance is below the next action amount", () => {
    mockUseWalletBalance.mockReturnValue({
      walletData: {
        balance: 10,
        solana_deposit_address: "So1anaAddress123",
        evm_deposit_address: "0xabc123",
      },
      loadingWallet: false,
      refetch: vi.fn(),
    });

    render(<AuctionDetailContent auctionId="auction-1" />);

    expect(screen.getByText(/needs funding/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
    expect(screen.getByText(/go to wallet/i)).toBeInTheDocument();
  });
});

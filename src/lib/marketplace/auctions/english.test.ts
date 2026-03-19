import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();
const mockHoldEscrow = vi.fn();
const mockRefundEscrow = vi.fn();
const mockReleaseEscrow = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockCalculatePlatformFee = vi.fn();
const mockLogError = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  holdEscrow: (...args: unknown[]) => mockHoldEscrow(...args),
  refundEscrow: (...args: unknown[]) => mockRefundEscrow(...args),
  releaseEscrow: (...args: unknown[]) => mockReleaseEscrow(...args),
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
  calculatePlatformFee: (...args: unknown[]) => mockCalculatePlatformFee(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

import { settleEnglishAuction } from "./english";

function createEnglishSupabaseStub() {
  const auctionUpdates: Array<Record<string, unknown>> = [];
  const bidUpdates: Array<Record<string, unknown>> = [];

  return {
    auctionUpdates,
    bidUpdates,
    from: vi.fn((table: string) => {
      if (table === "auctions") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "auction-1",
                  seller_id: "seller-1",
                  status: "active",
                  ends_at: "2000-03-19T00:00:00.000Z",
                  reserve_price: null,
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            auctionUpdates.push(payload);
            return {
              eq: () => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          },
        };
      }

      if (table === "auction_bids") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "bid-1",
                        bidder_id: "buyer-1",
                        bid_amount: 80,
                        escrow_hold_id: "escrow-1",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            bidUpdates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("settleEnglishAuction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReleaseEscrow.mockRejectedValue(new Error("settlement offline"));
    mockGetOrCreateWallet.mockResolvedValue({ id: "seller-wallet-1" });
    mockCalculatePlatformFee.mockResolvedValue({ feeAmount: 4 });
  });

  it("reopens the auction when winning escrow cannot be released", async () => {
    const supabase = createEnglishSupabaseStub();
    mockCreateAdminClient.mockReturnValue(supabase);

    const result = await settleEnglishAuction("auction-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Escrow release failed");
    expect(supabase.auctionUpdates).toContainEqual(
      expect.objectContaining({
        status: "active",
        winner_id: null,
        final_price: null,
      })
    );
    expect(supabase.bidUpdates).toContainEqual(
      expect.objectContaining({
        status: "active",
      })
    );
  });
});

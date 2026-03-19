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

import { placeBid, settleEnglishAuction } from "./english";

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

  it("does not cancel a no-winner auction when refunding an active bid fails", async () => {
    const auctionUpdates: Array<Record<string, unknown>> = [];
    const bidUpdates: Array<Record<string, unknown>> = [];
    let bidSelectCall = 0;
    const supabase = {
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
                    reserve_price: 100,
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              auctionUpdates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            },
          };
        }

        if (table === "auction_bids") {
          return {
            select: () => ({
              eq: () => {
                return {
                  eq: vi.fn(() => {
                    bidSelectCall += 1;
                    if (bidSelectCall === 1) {
                      return {
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
                      };
                    }

                    return Promise.resolve({
                      data: [{ id: "bid-1", escrow_hold_id: "escrow-1" }],
                      error: null,
                    });
                  }),
                };
              },
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
    mockCreateAdminClient.mockReturnValue(supabase);
    mockRefundEscrow.mockRejectedValueOnce(new Error("refund offline"));

    const result = await settleEnglishAuction("auction-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to refund an active bid during auction cancellation");
    expect(auctionUpdates).toHaveLength(0);
    expect(bidUpdates).toHaveLength(0);
  });
});

describe("placeBid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHoldEscrow.mockResolvedValue("escrow-new");
    mockRefundEscrow.mockResolvedValue(undefined);
    mockGetOrCreateWallet.mockResolvedValue({ id: "buyer-wallet-1" });
  });

  it("does not refund the previous highest bid when the optimistic-lock update loses the race", async () => {
    const bidUpdates: Array<Record<string, unknown>> = [];
    const supabase = {
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
                    ends_at: "2099-03-19T00:10:00.000Z",
                    auction_type: "english",
                    current_price: 50,
                    start_price: 40,
                    bid_increment_min: 5,
                    auto_extend_minutes: 5,
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: "race lost" },
                    }),
                  }),
                }),
              }),
            }),
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
                          id: "bid-prev",
                          escrow_hold_id: "escrow-prev",
                          bidder_id: "buyer-prev",
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "bid-new" },
                  error: null,
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
    mockCreateAdminClient.mockReturnValue(supabase);

    const result = await placeBid("auction-1", "buyer-2", 60);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Another bid was placed simultaneously");
    expect(mockRefundEscrow).toHaveBeenCalledTimes(1);
    expect(mockRefundEscrow).toHaveBeenCalledWith("escrow-new");
    expect(mockRefundEscrow).not.toHaveBeenCalledWith("escrow-prev");
    expect(bidUpdates).toContainEqual(
      expect.objectContaining({
        status: "cancelled",
      })
    );
    expect(bidUpdates).not.toContainEqual(
      expect.objectContaining({
        status: "outbid",
      })
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();
const mockHoldEscrow = vi.fn();
const mockRefundEscrow = vi.fn();
const mockReleaseEscrow = vi.fn();
const mockCalculatePlatformFee = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockLogError = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  holdEscrow: (...args: unknown[]) => mockHoldEscrow(...args),
  refundEscrow: (...args: unknown[]) => mockRefundEscrow(...args),
  releaseEscrow: (...args: unknown[]) => mockReleaseEscrow(...args),
  calculatePlatformFee: (...args: unknown[]) => mockCalculatePlatformFee(...args),
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

import { acceptDutchAuction } from "./dutch";

function createDutchSupabaseStub() {
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
                  ends_at: "2099-03-19T00:10:00.000Z",
                  auction_type: "dutch",
                  start_price: 100,
                  floor_price: 50,
                  price_decrement: 10,
                  decrement_interval_seconds: 60,
                  starts_at: "2099-03-19T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            auctionUpdates.push(payload);
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "auction-1" },
                      error: null,
                    }),
                  }),
                }),
                single: vi.fn().mockResolvedValue({
                  data: { id: "auction-1" },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "auction_bids") {
        return {
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "bid-1" },
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
}

describe("acceptDutchAuction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHoldEscrow.mockResolvedValue("escrow-1");
    mockRefundEscrow.mockResolvedValue(undefined);
    mockReleaseEscrow.mockRejectedValue(new Error("settlement offline"));
    mockCalculatePlatformFee.mockResolvedValue({ feeAmount: 5 });
    mockGetOrCreateWallet.mockResolvedValue({ id: "wallet-1" });
  });

  it("reopens the auction and refunds the buyer when payout fails", async () => {
    const supabase = createDutchSupabaseStub();
    mockCreateAdminClient.mockReturnValue(supabase);

    const result = await acceptDutchAuction("auction-1", "buyer-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Payment settlement failed");
    expect(mockRefundEscrow).toHaveBeenCalledWith("escrow-1");
    expect(supabase.auctionUpdates).toContainEqual(
      expect.objectContaining({
        status: "active",
        winner_id: null,
        final_price: null,
      })
    );
    expect(supabase.bidUpdates).toContainEqual(
      expect.objectContaining({
        status: "cancelled",
      })
    );
  });

  it("reopens the auction and refunds the buyer when the winning bid record cannot be saved", async () => {
    const supabase = createDutchSupabaseStub();
    supabase.from = vi.fn((table: string) => {
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
                  auction_type: "dutch",
                  start_price: 100,
                  floor_price: 50,
                  price_decrement: 10,
                  decrement_interval_seconds: 60,
                  starts_at: "2099-03-19T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            supabase.auctionUpdates.push(payload);
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "auction-1" },
                      error: null,
                    }),
                  }),
                }),
                single: vi.fn().mockResolvedValue({
                  data: { id: "auction-1" },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "auction_bids") {
        return {
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "insert failed" },
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            supabase.bidUpdates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateAdminClient.mockReturnValue(supabase);
    mockReleaseEscrow.mockResolvedValue(undefined);

    const result = await acceptDutchAuction("auction-1", "buyer-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to record winning bid");
    expect(mockRefundEscrow).toHaveBeenCalledWith("escrow-1");
    expect(supabase.auctionUpdates).toContainEqual(
      expect.objectContaining({
        status: "active",
        winner_id: null,
        final_price: null,
      })
    );
    expect(mockReleaseEscrow).not.toHaveBeenCalled();
  });
});

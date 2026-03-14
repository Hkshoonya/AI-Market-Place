import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { calculatePlatformFee } from "./wallet";

const ORIGINAL_ENABLE_MARKETPLACE_FEES = process.env.ENABLE_MARKETPLACE_FEES;

function createFeeClient() {
  return {
    from: (table: string) => {
      if (table === "wallets") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { total_earned: 2500 },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "platform_fee_tiers") {
        return {
          select: () => ({
            lte: () => ({
              or: () => ({
                order: () => ({
                  limit: () => ({
                    single: async () => ({
                      data: { fee_percentage: 5 },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("calculatePlatformFee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createFeeClient());
    delete process.env.ENABLE_MARKETPLACE_FEES;
  });

  afterEach(() => {
    if (ORIGINAL_ENABLE_MARKETPLACE_FEES === undefined) {
      delete process.env.ENABLE_MARKETPLACE_FEES;
    } else {
      process.env.ENABLE_MARKETPLACE_FEES = ORIGINAL_ENABLE_MARKETPLACE_FEES;
    }
  });

  it("returns zero fees when marketplace fees are disabled", async () => {
    const result = await calculatePlatformFee("wallet-1", 100);

    expect(result).toEqual({
      feeRate: 0,
      feeAmount: 0,
      netAmount: 100,
    });
  });

  it("returns tiered fees when marketplace fees are explicitly enabled", async () => {
    process.env.ENABLE_MARKETPLACE_FEES = "true";

    const result = await calculatePlatformFee("wallet-1", 100);

    expect(result).toEqual({
      feeRate: 0.05,
      feeAmount: 5,
      netAmount: 95,
    });
  });
});

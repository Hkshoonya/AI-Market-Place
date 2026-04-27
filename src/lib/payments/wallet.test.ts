import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();
const mockGenerateEvmDepositAddress = vi.fn();
const mockIsEvmConfigured = vi.fn();
const mockGenerateSolanaDepositAddress = vi.fn();
const mockIsSolanaConfigured = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/payments/chains/evm", () => ({
  generateEvmDepositAddress: (...args: unknown[]) => mockGenerateEvmDepositAddress(...args),
  isEvmConfigured: (...args: unknown[]) => mockIsEvmConfigured(...args),
}));

vi.mock("@/lib/payments/chains/solana", () => ({
  generateSolanaDepositAddress: (...args: unknown[]) =>
    mockGenerateSolanaDepositAddress(...args),
  isSolanaConfigured: (...args: unknown[]) => mockIsSolanaConfigured(...args),
}));

import { ensureWalletDepositAddresses, getOrCreateWallet } from "./wallet";
import type { Wallet } from "@/types/database";

describe("wallet chain defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEvmDepositAddress.mockResolvedValue(
      "0x1111111111111111111111111111111111111111"
    );
    mockGenerateSolanaDepositAddress.mockResolvedValue(
      "So11111111111111111111111111111111111111112"
    );
  });

  it("defaults a new wallet to Base when Solana is disabled and Base is configured", async () => {
    mockIsSolanaConfigured.mockReturnValue(false);
    mockIsEvmConfigured.mockImplementation((chain?: string) =>
      chain === undefined || chain === "base"
    );

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "wallet-1",
            owner_id: "user-1",
            owner_type: "user",
            balance: 0,
            held_balance: 0,
            total_earned: 0,
            total_spent: 0,
            primary_chain: "base",
            deposit_address_solana: null,
            deposit_address_evm: null,
            is_active: true,
            created_at: "",
            updated_at: "",
          },
          error: null,
        }),
      }),
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "not found" },
              }),
            }),
          }),
        }),
        insert,
      })),
    });

    await getOrCreateWallet("user-1");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_chain: "base",
      })
    );
  });

  it("re-homes a stale Solana primary chain to Base when only EVM deposit addresses are active", async () => {
    mockIsSolanaConfigured.mockReturnValue(false);
    mockIsEvmConfigured.mockImplementation((chain?: string) =>
      chain === undefined || chain === "base"
    );

    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "wallet-1",
              owner_id: "user-1",
              owner_type: "user",
              balance: 0,
              held_balance: 0,
              total_earned: 0,
              total_spent: 0,
              primary_chain: "base",
              deposit_address_solana: null,
              deposit_address_evm: "0x1111111111111111111111111111111111111111",
              is_active: true,
              created_at: "",
              updated_at: "",
            },
            error: null,
          }),
        }),
      }),
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update,
      })),
    });

    const wallet = {
      id: "wallet-1",
      owner_id: "user-1",
      owner_type: "user",
      balance: 0,
      held_balance: 0,
      total_earned: 0,
      total_spent: 0,
      primary_chain: "solana",
      deposit_address_solana: null,
      deposit_address_evm: null,
      is_active: true,
      created_at: "",
      updated_at: "",
    } satisfies Wallet;

    await ensureWalletDepositAddresses(wallet);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        deposit_address_solana: null,
        deposit_address_evm: "0x1111111111111111111111111111111111111111",
        primary_chain: "base",
      })
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDebitWallet = vi.fn();
const mockCreditWallet = vi.fn();
const mockSendSolanaTransfer = vi.fn();
const mockIsSolanaWithdrawalConfigured = vi.fn();
const mockSendEvmTransfer = vi.fn();
const mockIsEvmConfigured = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockError = vi.fn();

vi.mock("./wallet", () => ({
  debitWallet: (...args: unknown[]) => mockDebitWallet(...args),
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
}));

vi.mock("./chains/solana", () => ({
  sendSolanaTransfer: (...args: unknown[]) => mockSendSolanaTransfer(...args),
  isSolanaWithdrawalConfigured: (...args: unknown[]) =>
    mockIsSolanaWithdrawalConfigured(...args),
}));

vi.mock("./chains/evm", () => ({
  sendEvmTransfer: (...args: unknown[]) => mockSendEvmTransfer(...args),
  isEvmConfigured: (...args: unknown[]) => mockIsEvmConfigured(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockError(...args),
  }),
}));

import { getSupportedChains, getWithdrawalFee, processWithdrawal } from "./withdraw";

function createAdminClientStub() {
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  };
}

describe("processWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSolanaWithdrawalConfigured.mockReturnValue(true);
    mockIsEvmConfigured.mockReturnValue(true);
    mockDebitWallet.mockResolvedValue("tx-1");
    mockCreditWallet.mockResolvedValue("refund-1");
    mockCreateAdminClient.mockReturnValue(createAdminClientStub());
  });

  it("confirms the wallet transaction only after a confirmed on-chain transfer", async () => {
    mockSendEvmTransfer.mockResolvedValue({
      txHash: "0xabc",
      status: "confirmed",
      chain: "base",
      amount: 10,
      token: "USDC",
      blockNumber: 123,
    });

    const result = await processWithdrawal({
      walletId: "wallet-1",
      amount: 10,
      chain: "base",
      toAddress: "0x000000000000000000000000000000000000dEaD",
      token: "USDC",
    });

    expect(result).toEqual({
      success: true,
      txId: "tx-1",
      txHash: "0xabc",
    });
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });

  it("refunds the wallet when the chain adapter returns a failed transfer result", async () => {
    mockSendEvmTransfer.mockResolvedValue({
      txHash: "",
      status: "failed",
      chain: "base",
      amount: 10,
      token: "USDC",
      blockNumber: 0,
    });

    const result = await processWithdrawal({
      walletId: "wallet-1",
      amount: 10,
      chain: "base",
      toAddress: "0x000000000000000000000000000000000000dEaD",
      token: "USDC",
    });

    expect(result.success).toBe(false);
    expect(result.txId).toBe("tx-1");
    expect(result.error).toMatch(/on-chain transfer failed/i);
    expect(mockCreditWallet).toHaveBeenCalledWith(
      "wallet-1",
      10 + getWithdrawalFee("base"),
      "refund",
      expect.objectContaining({
        referenceType: "withdrawal_refund",
      })
    );
  });

  it("rejects native-token withdrawals before debiting a USDC wallet", async () => {
    const result = await processWithdrawal({
      walletId: "wallet-1",
      amount: 1,
      chain: "solana",
      toAddress: "GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB",
      token: "SOL",
    });

    expect(result).toEqual({
      success: false,
      error: "Only USDC withdrawals are supported",
    });
    expect(mockDebitWallet).not.toHaveBeenCalled();
    expect(mockSendSolanaTransfer).not.toHaveBeenCalled();
  });

  it("rejects unsupported Solana USDC withdrawals before debiting", async () => {
    mockIsSolanaWithdrawalConfigured.mockReturnValue(false);

    const result = await processWithdrawal({
      walletId: "wallet-1",
      amount: 10,
      chain: "solana",
      toAddress: "GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB",
      token: "USDC",
    });

    expect(result).toEqual({
      success: false,
      error: "Solana USDC withdrawals are not supported",
    });
    expect(mockDebitWallet).not.toHaveBeenCalled();
    expect(mockSendSolanaTransfer).not.toHaveBeenCalled();
  });
});

describe("getSupportedChains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reflects the active Solana and EVM chain configuration", () => {
    mockIsSolanaWithdrawalConfigured.mockReturnValue(false);
    mockIsEvmConfigured.mockImplementation((chain?: string) => chain === "base");

    expect(getSupportedChains()).toEqual([
      expect.objectContaining({ chain: "solana", configured: false }),
      expect.objectContaining({ chain: "base", configured: true }),
      expect.objectContaining({ chain: "polygon", configured: false }),
    ]);
  });
});

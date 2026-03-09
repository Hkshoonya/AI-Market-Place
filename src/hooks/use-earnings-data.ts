"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";

// ---------------------------------------------------------------------------
// Types (shared across earnings feature)
// ---------------------------------------------------------------------------

export interface EarningsData {
  balance: number;
  held: number;
  totalEarned: number;
  totalSpent: number;
  feeRate: number;
  feePercentage: string;
  recentTransactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  tx_hash?: string | null;
  chain?: string | null;
}

export interface ChainInfo {
  chain: string;
  configured: boolean;
  minWithdrawal: number;
  fee: number;
}

// ---------------------------------------------------------------------------
// Fee tier helper (also used by BalanceCards)
// ---------------------------------------------------------------------------

export function getFeeTierInfo(feeRate: number): {
  name: string;
  color: string;
  nextTier: string | null;
  progressPercent: number;
} {
  if (feeRate <= 0.02) {
    return {
      name: "Diamond",
      color: "text-cyan-400",
      nextTier: null,
      progressPercent: 100,
    };
  }
  if (feeRate <= 0.03) {
    return {
      name: "Platinum",
      color: "text-purple-400",
      nextTier: "Diamond (2%)",
      progressPercent: 80,
    };
  }
  if (feeRate <= 0.05) {
    return {
      name: "Gold",
      color: "text-amber-400",
      nextTier: "Platinum (3%)",
      progressPercent: 60,
    };
  }
  if (feeRate <= 0.08) {
    return {
      name: "Silver",
      color: "text-zinc-300",
      nextTier: "Gold (5%)",
      progressPercent: 40,
    };
  }
  return {
    name: "Standard",
    color: "text-zinc-400",
    nextTier: "Silver (8%)",
    progressPercent: 20,
  };
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseEarningsDataReturn {
  earnings: EarningsData | null;
  chains: ChainInfo[];
  loading: boolean;
  error: string | null;
  withdrawAmount: string;
  setWithdrawAmount: (v: string) => void;
  selectedChain: string;
  setSelectedChain: (v: string) => void;
  walletAddress: string;
  setWalletAddress: (v: string) => void;
  withdrawing: boolean;
  withdrawStatus: { type: "success" | "error"; message: string } | null;
  handleWithdraw: () => Promise<void>;
  retryFetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEarningsData(userId: string | undefined): UseEarningsDataReturn {
  const {
    data: earnings,
    error: swrError,
    isLoading: loadingEarnings,
    mutate: mutateEarnings,
  } = useSWR<EarningsData>(
    userId ? "/api/seller/earnings" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  const {
    data: chainsData,
    isLoading: loadingChains,
  } = useSWR<{ chains: ChainInfo[] }>(
    userId ? "/api/seller/withdraw" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  const chains = chainsData?.chains ?? [];
  const loading = loadingEarnings || loadingChains;
  const error = swrError ? (swrError as Error).message || "Failed to load earnings" : null;

  // Form / UI state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedChain, setSelectedChain] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Set selectedChain from first configured chain when chainsData arrives
  useEffect(() => {
    if (chainsData?.chains) {
      const firstConfigured = chainsData.chains.find((c) => c.configured);
      if (firstConfigured) {
        setSelectedChain(firstConfigured.chain);
      }
    }
  }, [chainsData]);

  const handleWithdraw = async () => {
    setWithdrawStatus(null);
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setWithdrawStatus({ type: "error", message: "Enter a valid amount." });
      return;
    }
    if (!selectedChain) {
      setWithdrawStatus({ type: "error", message: "Select a chain." });
      return;
    }
    if (!walletAddress.trim() || walletAddress.trim().length < 20) {
      setWithdrawStatus({
        type: "error",
        message: "Enter a valid wallet address.",
      });
      return;
    }

    setWithdrawing(true);
    try {
      const res = await fetch("/api/seller/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          chain: selectedChain,
          wallet_address: walletAddress.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Withdrawal failed");
      }
      setWithdrawStatus({
        type: "success",
        message:
          (data as { message?: string }).message ||
          `Withdrawal of $${amount.toFixed(2)} initiated!`,
      });
      setWithdrawAmount("");
      setWalletAddress("");
      mutateEarnings();
    } catch (err: unknown) {
      setWithdrawStatus({
        type: "error",
        message: (err as Error).message || "Withdrawal failed. Please try again.",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const retryFetch = () => {
    mutateEarnings();
  };

  return {
    earnings: earnings ?? null,
    chains,
    loading,
    error,
    withdrawAmount,
    setWithdrawAmount,
    selectedChain,
    setSelectedChain,
    walletAddress,
    setWalletAddress,
    withdrawing,
    withdrawStatus,
    handleWithdraw,
    retryFetch,
  };
}

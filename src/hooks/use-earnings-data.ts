"use client";

import { useState, useCallback, useEffect } from "react";

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
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedChain, setSelectedChain] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchEarnings = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/seller/earnings");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to load earnings");
      }
      const data = await res.json();
      setEarnings(data as EarningsData);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load earnings");
    }
  }, []);

  const fetchChains = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/withdraw");
      if (!res.ok) return;
      const data = await res.json();
      const fetchedChains: ChainInfo[] = (data as { chains?: ChainInfo[] }).chains || [];
      setChains(fetchedChains);
      const firstConfigured = fetchedChains.find((c) => c.configured);
      if (firstConfigured) {
        setSelectedChain(firstConfigured.chain);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (userId) {
      Promise.all([fetchEarnings(), fetchChains()]).finally(() =>
        setLoading(false)
      );
    }
  }, [userId, fetchEarnings, fetchChains]);

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
      fetchEarnings();
    } catch (err: unknown) {
      setWithdrawStatus({
        type: "error",
        message: (err as Error).message || "Withdrawal failed. Please try again.",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const retryFetch = useCallback(() => {
    setLoading(true);
    fetchEarnings().finally(() => setLoading(false));
  }, [fetchEarnings]);

  return {
    earnings,
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

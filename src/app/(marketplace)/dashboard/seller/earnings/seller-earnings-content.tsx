"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Lock,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth-provider";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EarningsData {
  balance: number;
  held: number;
  totalEarned: number;
  totalSpent: number;
  feeRate: number;
  feePercentage: string;
  recentTransactions: Transaction[];
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  tx_hash?: string | null;
  chain?: string | null;
}

interface ChainInfo {
  chain: string;
  configured: boolean;
  minWithdrawal: number;
  fee: number;
}

// ---------------------------------------------------------------------------
// Fee tier helpers
// ---------------------------------------------------------------------------

function getFeeTierInfo(feeRate: number): {
  name: string;
  color: string;
  nextTier: string | null;
  progressPercent: number;
} {
  // Tier thresholds (lower fee = better tier)
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
// Transaction styling helpers
// ---------------------------------------------------------------------------

function txTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sale: "Sale",
    escrow_release: "Escrow Release",
    platform_fee: "Platform Fee",
    withdrawal: "Withdrawal",
    refund: "Refund",
    deposit: "Deposit",
    purchase: "Purchase",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function txTypeColor(type: string): string {
  switch (type) {
    case "sale":
    case "escrow_release":
      return "text-gain";
    case "platform_fee":
      return "text-loss";
    case "withdrawal":
      return "text-blue-400";
    case "refund":
      return "text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function txStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
    case "completed":
      return (
        <Badge variant="secondary" className="bg-gain/10 text-gain border-gain/20">
          Confirmed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="secondary" className="bg-loss/10 text-loss border-loss/20">
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {status}
        </Badge>
      );
  }
}

function txAmountPrefix(type: string): string {
  switch (type) {
    case "sale":
    case "escrow_release":
    case "refund":
    case "deposit":
      return "+";
    case "platform_fee":
    case "withdrawal":
    case "purchase":
      return "-";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 10;

export default function SellerEarningsContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Data states
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Withdraw form states
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedChain, setSelectedChain] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/dashboard/seller/earnings");
    }
  }, [user, authLoading, router]);

  // Fetch earnings data
  const fetchEarnings = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/seller/earnings");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load earnings");
      }
      const data = await res.json();
      setEarnings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load earnings");
    }
  }, []);

  // Fetch supported chains
  const fetchChains = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/withdraw");
      if (!res.ok) return;
      const data = await res.json();
      setChains(data.chains || []);
      // Auto-select the first configured chain
      const firstConfigured = (data.chains || []).find((c: ChainInfo) => c.configured);
      if (firstConfigured) {
        setSelectedChain(firstConfigured.chain);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (user) {
      Promise.all([fetchEarnings(), fetchChains()]).finally(() =>
        setLoading(false)
      );
    }
  }, [user, fetchEarnings, fetchChains]);

  // Handle withdrawal
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
        throw new Error(data.error || "Withdrawal failed");
      }
      setWithdrawStatus({
        type: "success",
        message: data.message || `Withdrawal of $${amount.toFixed(2)} initiated!`,
      });
      setWithdrawAmount("");
      setWalletAddress("");
      // Refresh earnings data
      fetchEarnings();
    } catch (err: any) {
      setWithdrawStatus({
        type: "error",
        message: err.message || "Withdrawal failed. Please try again.",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  // Pagination logic
  const transactions = earnings?.recentTransactions || [];
  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const paginatedTx = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Selected chain info
  const selectedChainInfo = chains.find((c) => c.chain === selectedChain);

  // Loading skeleton
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-72 rounded bg-secondary" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-secondary" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-secondary" />
          <div className="h-80 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (error && !earnings) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <Wallet className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Earnings & Payouts</h1>
        </div>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-8 text-center">
            <p className="text-loss mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true);
                fetchEarnings().finally(() => setLoading(false));
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const feeTier = earnings
    ? getFeeTierInfo(earnings.feeRate)
    : { name: "Standard", color: "text-zinc-400", nextTier: null, progressPercent: 20 };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Earnings & Payouts</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => router.push("/dashboard/seller")}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Balance Overview Cards                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Available Balance */}
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gain/10">
                <DollarSign className="h-5 w-5 text-gain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-gain">
                  ${(earnings?.balance ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Held in Escrow */}
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Lock className="h-5 w-5 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Held in Escrow</p>
                <p className="text-2xl font-bold">
                  ${(earnings?.held ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Earned */}
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
                <TrendingUp className="h-5 w-5 text-neon" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">
                  ${(earnings?.totalEarned ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Tier */}
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <ArrowUpRight className="h-5 w-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Fee Tier</p>
                <p className={`text-lg font-bold ${feeTier.color}`}>
                  {earnings?.feePercentage ?? "---"}{" "}
                  <span className="text-sm font-medium">({feeTier.name})</span>
                </p>
              </div>
            </div>
            {/* Progress bar to next tier */}
            {feeTier.nextTier && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{feeTier.name}</span>
                  <span>Next: {feeTier.nextTier}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-neon transition-all duration-500"
                    style={{ width: `${feeTier.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Withdraw                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border-border/50 bg-card mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-neon" />
            Withdraw Funds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Form */}
            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Amount (USDC)
                </label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setWithdrawAmount(e.target.value)
                    }
                    className="bg-secondary pl-7"
                  />
                  {earnings && earnings.balance > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setWithdrawAmount(earnings.balance.toFixed(2))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neon hover:text-neon/80 font-medium"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>

              {/* Chain selector */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Chain
                </label>
                <div className="mt-1">
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger className="w-full bg-secondary">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      {chains.map((c) => (
                        <SelectItem
                          key={c.chain}
                          value={c.chain}
                          disabled={!c.configured}
                        >
                          <span className="flex items-center gap-2">
                            <span className="capitalize">{c.chain}</span>
                            {!c.configured && (
                              <span className="text-xs text-muted-foreground">
                                (not available)
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Wallet address */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Wallet Address
                </label>
                <Input
                  placeholder={
                    selectedChain === "solana"
                      ? "e.g. 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
                      : "e.g. 0x742d35Cc6634C0532925a3b844Bc9e7595f..."
                  }
                  value={walletAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setWalletAddress(e.target.value)
                  }
                  className="mt-1 bg-secondary"
                />
              </div>

              {/* Withdraw button */}
              <Button
                className="w-full gap-2 bg-neon text-background hover:bg-neon/90"
                disabled={withdrawing || !withdrawAmount || !selectedChain || !walletAddress}
                onClick={handleWithdraw}
              >
                {withdrawing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                {withdrawing ? "Processing..." : "Withdraw"}
              </Button>

              {/* Status message */}
              {withdrawStatus && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    withdrawStatus.type === "success"
                      ? "border-gain/20 bg-gain/5 text-gain"
                      : "border-loss/20 bg-loss/5 text-loss"
                  }`}
                >
                  {withdrawStatus.message}
                </div>
              )}
            </div>

            {/* Right: Info panel */}
            <div className="rounded-xl border border-border/50 bg-secondary/30 p-5 space-y-4">
              <h3 className="text-sm font-semibold">Withdrawal Details</h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Available Balance</span>
                  <span className="font-medium text-gain">
                    ${(earnings?.balance ?? 0).toFixed(2)}
                  </span>
                </div>

                {selectedChainInfo && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Minimum Withdrawal</span>
                      <span className="font-medium">
                        ${selectedChainInfo.minWithdrawal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Network Fee</span>
                      <span className="font-medium">
                        ${selectedChainInfo.fee.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">You Receive</span>
                      <span className="font-bold text-white">
                        $
                        {Math.max(
                          0,
                          (parseFloat(withdrawAmount) || 0) - selectedChainInfo.fee
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}

                {!selectedChainInfo && (
                  <p className="text-muted-foreground text-xs">
                    Select a chain to see fee details.
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Important</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Withdrawals are processed in USDC.</li>
                  <li>Double-check your wallet address before submitting.</li>
                  <li>Processing typically takes 1-5 minutes.</li>
                  <li>Incorrect addresses may result in lost funds.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Recent Transactions                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-neon" />
              Recent Transactions
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {transactions.length} transaction{transactions.length !== 1 && "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                No transactions yet. Earnings from sales will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="pb-3 pr-4 text-left font-medium">Date</th>
                      <th className="pb-3 pr-4 text-left font-medium">Type</th>
                      <th className="pb-3 pr-4 text-right font-medium">Amount</th>
                      <th className="pb-3 pr-4 text-left font-medium">Status</th>
                      <th className="pb-3 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTx.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                      >
                        {/* Date */}
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          <span className="block text-[10px] text-muted-foreground/60">
                            {new Date(tx.created_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-3 pr-4">
                          <span className={`font-medium ${txTypeColor(tx.type)}`}>
                            {txTypeLabel(tx.type)}
                          </span>
                          {tx.chain && (
                            <span className="ml-2 text-[10px] uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                              {tx.chain}
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          <span className={`font-mono font-medium ${txTypeColor(tx.type)}`}>
                            {txAmountPrefix(tx.type)}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 pr-4">{txStatusBadge(tx.status)}</td>

                        {/* Description */}
                        <td className="py-3 max-w-[200px] truncate text-muted-foreground text-xs">
                          {tx.description || "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        // Show first, last, current, and adjacent pages
                        return (
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - currentPage) <= 1
                        );
                      })
                      .map((page, idx, arr) => {
                        // Insert ellipsis between non-adjacent pages
                        const showEllipsisBefore =
                          idx > 0 && page - arr[idx - 1] > 1;
                        return (
                          <span key={page} className="flex items-center">
                            {showEllipsisBefore && (
                              <span className="px-1 text-xs text-muted-foreground">
                                ...
                              </span>
                            )}
                            <Button
                              variant={page === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={`h-8 w-8 p-0 ${
                                page === currentPage
                                  ? "bg-neon text-background hover:bg-neon/90"
                                  : ""
                              }`}
                            >
                              {page}
                            </Button>
                          </span>
                        );
                      })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

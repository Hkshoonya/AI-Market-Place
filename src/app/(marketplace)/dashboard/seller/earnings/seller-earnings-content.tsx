"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useEarningsData } from "@/hooks/use-earnings-data";
import { BalanceCards } from "@/components/marketplace/balance-cards";
import { WithdrawalForm } from "@/components/marketplace/withdrawal-form";
import { TransactionTable } from "@/components/marketplace/transaction-table";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SellerEarningsContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const earningsData = useEarningsData(user?.id);
  const {
    earnings,
    chains,
    loading,
    error,
    retryFetch,
    withdrawAmount,
    setWithdrawAmount,
    selectedChain,
    setSelectedChain,
    walletAddress,
    setWalletAddress,
    withdrawing,
    withdrawStatus,
    handleWithdraw,
  } = earningsData;

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/dashboard/seller/earnings");
    }
  }, [user, authLoading, router]);

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
          <h1 className="text-2xl font-bold">Earnings &amp; Payouts</h1>
        </div>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-8 text-center">
            <p className="text-loss mb-4">{error}</p>
            <Button variant="outline" onClick={retryFetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Earnings &amp; Payouts</h1>
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

      <BalanceCards earnings={earnings} />

      <WithdrawalForm
        earnings={earnings}
        chains={chains}
        withdrawAmount={withdrawAmount}
        setWithdrawAmount={setWithdrawAmount}
        selectedChain={selectedChain}
        setSelectedChain={setSelectedChain}
        walletAddress={walletAddress}
        setWalletAddress={setWalletAddress}
        withdrawing={withdrawing}
        withdrawStatus={withdrawStatus}
        onWithdraw={handleWithdraw}
      />

      <TransactionTable transactions={earnings?.recentTransactions ?? []} />
    </div>
  );
}

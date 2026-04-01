"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SettlementPolicyCallout } from "@/components/marketplace/settlement-policy-callout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import { SWR_TIERS } from "@/lib/swr/config";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  formatWalletTopUpList,
  SUGGESTED_WALLET_TOP_UP_LABELS,
} from "@/lib/constants/wallet";

const ITEMS_PER_PAGE = 10;

const TX_TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "purchase", label: "Purchases" },
  { key: "sale", label: "Sales" },
  { key: "withdrawal", label: "Withdrawals" },
] as const;

type TxTypeFilter = (typeof TX_TYPE_FILTERS)[number]["key"];

interface WalletData {
  balance: number;
  escrow_balance: number;
  total_earned: number;
  total_spent: number;
  primary_chain: string | null;
  solana_deposit_address: string | null;
  evm_deposit_address: string | null;
  transactions: Transaction[];
  total_transactions: number;
}

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  chain: string | null;
  status: string;
  description: string | null;
}

export default function WalletContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<TxTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState("");
  const deployIntent = searchParams.get("intent");
  const starterModel = searchParams.get("model");
  const starterModelSlug = searchParams.get("modelSlug");
  const starterProvider = searchParams.get("provider");
  const starterAction = searchParams.get("action");
  const starterNext = searchParams.get("next");
  const starterSponsored = searchParams.get("sponsored") === "1";
  const starterAmountRaw = searchParams.get("amount");
  const starterAmount =
    starterAmountRaw && Number.isFinite(Number(starterAmountRaw))
      ? Number(starterAmountRaw)
      : null;

  const { data: wallet, isLoading: loading, error: swrError, mutate } = useSWR<WalletData | null>(
    user ? `supabase:wallet:${filter}:${page}` : null,
    async () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("type", filter);
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));

      const res = await fetch(`/api/marketplace/wallet?${params}`);
      if (!res.ok) {
        if (res.status === 404) {
          // No wallet yet, that is fine
          return null;
        }
        throw new Error("Failed to fetch wallet data");
      }
      return await res.json();
    },
    { ...SWR_TIERS.MEDIUM }
  );
  const hasStarterBalance =
    starterAmount != null ? (wallet?.balance ?? 0) >= starterAmount : false;

  const error = generateError || (swrError ? (swrError instanceof Error ? swrError.message : "Something went wrong") : "");

  useEffect(() => {
    if (!authLoading && !user) {
      const queryString = searchParams.toString();
      const redirectTarget = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }, [authLoading, pathname, router, searchParams, user]);

  const handleGenerateAddress = async () => {
    setGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/marketplace/wallet", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate deposit addresses");
      await mutate();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const handleFilterChange = (newFilter: TxTypeFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const totalPages = wallet
    ? Math.ceil(wallet.total_transactions / ITEMS_PER_PAGE)
    : 0;

  // Auth loading skeleton
  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-40 rounded-xl bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
          <Wallet className="h-5 w-5 text-neon" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Manage your balance, deposits, and transactions
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {deployIntent === "deploy" && starterModel && starterNext ? (
        <Card className="mb-6 border-neon/20 bg-neon/5">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                  Deploy Starter
                </Badge>
                {starterProvider ? (
                  <span className="text-sm text-muted-foreground">via {starterProvider}</span>
                ) : null}
              </div>
              <h2 className="text-lg font-semibold">Continue setup for {starterModel}</h2>
              <p className="text-sm text-muted-foreground">
                {starterAction
                  ? `${starterAction} is the best verified next step for this model.`
                  : "This is the best verified next step for this model."}{" "}
                Fund your wallet here first if needed, then continue without losing context.
              </p>
              {starterAmount ? (
                <p className="text-xs text-muted-foreground">
                  Recommended balance for this path: {formatCurrency(starterAmount)}.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {starterModelSlug ? (
                <Button variant="outline" asChild>
                  <Link href={`/models/${starterModelSlug}?tab=deploy#model-tabs`}>
                    Back to Model
                  </Link>
                </Button>
              ) : null}
              <Button asChild className="bg-neon text-background hover:bg-neon/90">
                <a
                  href={starterNext}
                  target="_blank"
                  rel={
                    starterSponsored
                      ? "noopener noreferrer sponsored nofollow"
                      : "noopener noreferrer"
                  }
                >
                  {hasStarterBalance ? "Continue to Provider" : "Continue After Top-Up"}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Section 1: Balance Card */}
      <Card className="border-neon/20 bg-neon/5 mb-6">
        <CardContent className="p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Available balance */}
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="mt-1 text-3xl font-bold text-neon">
                {loading ? (
                  <span className="inline-block h-9 w-28 animate-pulse rounded bg-secondary" />
                ) : (
                  formatCurrency(wallet?.balance ?? 0)
                )}
              </p>
            </div>

            {/* Escrow */}
            <div>
              <p className="text-sm text-muted-foreground">Held in Escrow</p>
              <p className="mt-1 text-xl font-semibold text-amber-400">
                {loading ? (
                  <span className="inline-block h-7 w-20 animate-pulse rounded bg-secondary" />
                ) : (
                  formatCurrency(wallet?.escrow_balance ?? 0)
                )}
              </p>
            </div>

            {/* Total earned */}
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="mt-1 text-xl font-semibold text-emerald-400">
                {loading ? (
                  <span className="inline-block h-7 w-20 animate-pulse rounded bg-secondary" />
                ) : (
                  formatCurrency(wallet?.total_earned ?? 0)
                )}
              </p>
            </div>

            {/* Total spent */}
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="mt-1 text-xl font-semibold text-red-400">
                {loading ? (
                  <span className="inline-block h-7 w-20 animate-pulse rounded bg-secondary" />
                ) : (
                  formatCurrency(wallet?.total_spent ?? 0)
                )}
              </p>
            </div>
          </div>

          {wallet?.primary_chain && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Primary Chain:{" "}
                <Badge variant="outline" className="ml-1 text-xs">
                  {wallet.primary_chain}
                </Badge>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 border-border/50 bg-card">
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="text-lg font-semibold">Top up credits once, then buy directly</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your wallet powers marketplace purchases. Add USDC here, then reuse that balance across paid listings,
              subscriptions, and future pay-as-you-go usage.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              The simplest top-up packs are {formatWalletTopUpList()}. After that, spending draws
              down from the same balance.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/30 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Suggested top-up packs
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_WALLET_TOP_UP_LABELS.map((amount) => (
                <Badge key={amount} variant="outline" className="border-neon/20 bg-neon/5 text-neon">
                  {amount}
                </Badge>
              ))}
            </div>
            <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>1. Copy a deposit address below.</li>
              <li>2. Send USDC on Solana, Base, or Polygon.</li>
              <li>3. Wait for the balance to appear, then buy from any listing.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Deposit Addresses */}
      <Card className="border-border/50 bg-card mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-1">Deposit Addresses</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Send USDC to these addresses to fund your wallet
          </p>

          {wallet?.solana_deposit_address || wallet?.evm_deposit_address ? (
            <div className="space-y-3">
              {/* Solana address */}
              {wallet.solana_deposit_address && (
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      Solana (USDC)
                    </p>
                    <p className="truncate font-mono text-sm text-foreground">
                      {wallet.solana_deposit_address}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      copyToClipboard(wallet.solana_deposit_address!, "solana")
                    }
                    className="shrink-0"
                  >
                    {copiedField === "solana" ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {/* EVM address */}
              {wallet.evm_deposit_address && (
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      EVM &mdash; Base &amp; Polygon (USDC)
                    </p>
                    <p className="truncate font-mono text-sm text-foreground">
                      {wallet.evm_deposit_address}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      copyToClipboard(wallet.evm_deposit_address!, "evm")
                    }
                    className="shrink-0"
                  >
                    {copiedField === "evm" ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 bg-secondary/10 py-8 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                No deposit addresses generated yet
              </p>
              <Button
                onClick={handleGenerateAddress}
                disabled={generating}
                className="mt-4 bg-neon text-background hover:bg-neon/90"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Address"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SettlementPolicyCallout className="mb-6" />

      {/* Section 3: Transaction History */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Transaction History</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => mutate()}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {/* Type filter buttons */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {TX_TYPE_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange(f.key)}
                className={
                  filter === f.key
                    ? "bg-neon text-background hover:bg-neon/90"
                    : ""
                }
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded bg-secondary"
                />
              ))}
            </div>
          ) : !wallet?.transactions?.length ? (
            <div className="rounded-lg border border-dashed border-border/50 bg-secondary/10 py-12 text-center">
              <RefreshCw className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No transactions found
              </p>
              <Button asChild className="mt-4 bg-neon text-background hover:bg-neon/90">
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs">
                          {tx.type === "deposit" || tx.type === "sale" ? (
                            <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3 text-red-400" />
                          )}
                          <span className="capitalize">{tx.type}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span
                          className={
                            tx.type === "deposit" || tx.type === "sale" || tx.type === "refund"
                              ? "text-emerald-400"
                              : tx.type === "purchase"
                                ? "text-red-400"
                                : "text-amber-400"
                          }
                        >
                          {tx.type === "deposit" || tx.type === "sale" || tx.type === "refund"
                            ? "+"
                            : "-"}
                          {formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tx.chain ? (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {tx.chain}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            &mdash;
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            tx.status === "completed"
                              ? "text-emerald-400 border-emerald-500/30"
                              : tx.status === "pending"
                                ? "text-amber-400 border-amber-500/30"
                                : tx.status === "failed"
                                  ? "text-red-400 border-red-500/30"
                                  : "text-muted-foreground border-border"
                          }`}
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {tx.description || "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({wallet.total_transactions}{" "}
                    total)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
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

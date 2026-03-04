"use client";

import { ArrowDownToLine, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type EarningsData, type ChainInfo } from "@/hooks/use-earnings-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WithdrawalFormProps {
  earnings: EarningsData | null;
  chains: ChainInfo[];
  withdrawAmount: string;
  setWithdrawAmount: (v: string) => void;
  selectedChain: string;
  setSelectedChain: (v: string) => void;
  walletAddress: string;
  setWalletAddress: (v: string) => void;
  withdrawing: boolean;
  withdrawStatus: { type: "success" | "error"; message: string } | null;
  onWithdraw: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WithdrawalForm({
  earnings,
  chains,
  withdrawAmount,
  setWithdrawAmount,
  selectedChain,
  setSelectedChain,
  walletAddress,
  setWalletAddress,
  withdrawing,
  withdrawStatus,
  onWithdraw,
}: WithdrawalFormProps) {
  const selectedChainInfo = chains.find((c) => c.chain === selectedChain);

  return (
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
              onClick={onWithdraw}
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
  );
}

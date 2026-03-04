"use client";

import { ArrowUpRight, DollarSign, Lock, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { type EarningsData, getFeeTierInfo } from "@/hooks/use-earnings-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BalanceCardsProps {
  earnings: EarningsData | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BalanceCards({ earnings }: BalanceCardsProps) {
  const feeTier = earnings
    ? getFeeTierInfo(earnings.feeRate)
    : { name: "Standard", color: "text-zinc-400", nextTier: null, progressPercent: 20 };

  return (
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
  );
}

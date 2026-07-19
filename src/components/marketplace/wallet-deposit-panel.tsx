"use client";

import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WalletBalance } from "@/hooks/use-wallet-balance";
import {
  formatWalletTopUpList,
  getRecommendedWalletTopUpAmount,
  SUGGESTED_WALLET_TOP_UP_LABELS,
} from "@/lib/constants/wallet";
import { WalletCardTopUpButton } from "./wallet-card-top-up-button";

interface WalletDepositPanelProps {
  walletData: WalletBalance | null;
  price: number | null;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  returnPath: string;
}

export function WalletDepositPanel({
  walletData,
  price,
  copiedField,
  onCopy,
  returnPath,
}: WalletDepositPanelProps) {
  const amountNeeded = Math.max((price ?? 0) - (walletData?.balance ?? 0), 0);
  const recommendedAmount = getRecommendedWalletTopUpAmount(amountNeeded);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-400">Insufficient balance</p>
      <p className="text-xs text-muted-foreground">
        Add wallet credits by card for the fastest checkout, or deposit USDC to an active chain
        address. Common top-up packs are {formatWalletTopUpList()}.
      </p>
      {recommendedAmount ? (
        <p className="text-xs text-amber-200">
          Best next step for this purchase: top up at least ${recommendedAmount}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_WALLET_TOP_UP_LABELS.map((amount) => (
          <span
            key={amount}
            className="rounded-full border border-amber-500/20 bg-background/60 px-2.5 py-1 text-[11px] text-amber-200"
          >
            {amount}
          </span>
        ))}
      </div>

      <WalletCardTopUpButton
        amount={amountNeeded}
        returnPath={returnPath}
        className="bg-neon text-background hover:bg-neon/90"
      />

      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Or deposit USDC on-chain
      </p>

      {walletData?.solana_deposit_address && (
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Solana
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
              {walletData.solana_deposit_address}
            </code>
            <button
              onClick={() => onCopy(walletData.solana_deposit_address!, "sol")}
              aria-label="Copy Solana address"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {copiedField === "sol" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {walletData?.evm_deposit_address && (
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Base / Polygon
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
              {walletData.evm_deposit_address}
            </code>
            <button
              onClick={() => onCopy(walletData.evm_deposit_address!, "evm")}
              aria-label="Copy EVM address"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {copiedField === "evm" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      <Button asChild variant="outline" size="sm" className="mt-2 w-full">
        <Link href="/wallet">View all wallet options</Link>
      </Button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WalletBalance } from "@/hooks/use-wallet-balance";

interface WalletDepositPanelProps {
  walletData: WalletBalance | null;
  price: number | null;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

export function WalletDepositPanel({
  walletData,
  price: _price,
  copiedField,
  onCopy,
}: WalletDepositPanelProps) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-400">Insufficient balance</p>
      <p className="text-xs text-muted-foreground">Deposit USDC to fund your wallet:</p>

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

      <Button asChild variant="outline" size="sm" className="w-full mt-2">
        <Link href="/wallet">Go to Wallet</Link>
      </Button>
    </div>
  );
}

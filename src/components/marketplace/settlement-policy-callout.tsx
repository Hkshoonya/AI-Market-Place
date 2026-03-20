import { ArrowLeftRight, ShieldCheck, Wallet } from "lucide-react";
import { getMarketplaceFeeHeadline } from "@/lib/marketplace/settlement";

interface SettlementPolicyCalloutProps {
  className?: string;
}

export function SettlementPolicyCallout({
  className = "",
}: SettlementPolicyCalloutProps) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-secondary/20 p-4 ${className}`.trim()}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <ArrowLeftRight className="h-3.5 w-3.5 text-neon" />
        Marketplace settlement options
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-neon" />
            Direct wallet settlement
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Direct deals keep custody with the parties while the platform can still track context and communications.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-neon" />
            Assisted escrow via AI Market Cap
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use the platform as the middle layer when you want mediated handling, clearer investigations, or a more guided transaction path.
          </p>
        </div>
        <div className="rounded-xl border border-neon/20 bg-neon/5 p-3">
          <div className="text-sm font-semibold text-neon">{getMarketplaceFeeHeadline()}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            The public fee message stays simple today. Direct settlement stays free, and assisted escrow is currently waived during the launch window.
          </p>
        </div>
      </div>
    </div>
  );
}

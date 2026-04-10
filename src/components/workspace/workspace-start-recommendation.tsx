"use client";

import { Badge } from "@/components/ui/badge";
import { WALLET_TOP_UP_PACKS } from "@/lib/constants/wallet";
import { cn } from "@/lib/utils";

interface WorkspaceStartRecommendationProps {
  action?: string | null;
  provider?: string | null;
  suggestedAmount?: number | null;
  suggestedPack?: string | null;
  suggestedPackSlug?: string | null;
  compact?: boolean;
  className?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function WorkspaceStartRecommendation({
  action,
  provider,
  suggestedAmount,
  suggestedPack,
  suggestedPackSlug,
  compact = false,
  className,
}: WorkspaceStartRecommendationProps) {
  if (!action && !provider && suggestedAmount == null && !suggestedPack) {
    return null;
  }

  const suggestedPackDetails =
    WALLET_TOP_UP_PACKS.find((pack) => pack.slug === suggestedPackSlug) ?? null;
  const inferredPackLabel = suggestedPack ?? suggestedPackDetails?.label ?? null;

  return (
    <div className={cn("rounded-lg border border-border/40 bg-background/40 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Suggested start
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {action ?? "Continue with the recommended path"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {suggestedAmount != null
              ? "These defaults were preloaded from the model you picked so you can launch faster and adjust later."
              : "This path was preloaded from the model you picked so you can launch faster and adjust later."}
          </p>
        </div>
        {provider ? (
          <Badge variant="outline" className="border-border/50 bg-card/40">
            via {provider}
          </Badge>
        ) : null}
      </div>

      <div className={cn("mt-3 grid gap-3", compact ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
        <div className="rounded-md border border-border/40 bg-card/30 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Starting budget
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {suggestedAmount != null ? formatCurrency(suggestedAmount) : "No top-up suggested"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {suggestedAmount != null
              ? "This becomes the initial deployment budget cap. You can change it before or after launch."
              : "This path does not need a preloaded wallet top-up right away."}
          </p>
        </div>
        <div className="rounded-md border border-border/40 bg-card/30 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Wallet pack
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {inferredPackLabel ?? "Choose any pack later"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {suggestedPackDetails?.description ??
              (inferredPackLabel
                ? "This is the closest wallet pack to the recommended starting budget."
                : "You can keep going without selecting a pack yet and decide at funding time.")}
          </p>
        </div>
      </div>
    </div>
  );
}

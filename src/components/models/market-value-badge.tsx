"use client";

import { Info, Sparkles } from "lucide-react";
import {
  buildMarketValueExplanation,
  type MarketValueInputs,
  renderStars,
} from "@/lib/models/market-value";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MarketValueBadgeProps extends MarketValueInputs {
  className?: string;
  supportingText?: string | null;
  align?: "start" | "center" | "end";
}

export function MarketValueBadge({
  className,
  supportingText,
  align = "end",
  ...inputs
}: MarketValueBadgeProps) {
  const explanation = buildMarketValueExplanation(inputs);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Estimated market value"
          title="Estimated market value. Click for methodology."
          className={cn(
            "inline-flex flex-col items-end gap-1 rounded-lg border border-border/50 bg-card/20 px-2.5 py-1.5 text-right transition-colors hover:border-neon/30 hover:bg-card/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/40",
            className
          )}
        >
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-neon">
            <Sparkles className="h-3.5 w-3.5" />
            {explanation.formattedValue}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {supportingText ?? explanation.confidenceLabel}
            <Info className="h-3 w-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neon/80">
            Estimated Market Value
          </div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {explanation.formattedValue}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{explanation.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground">
            Confidence:{" "}
            <span className="font-medium text-foreground">{explanation.confidenceLabel}</span>
          </span>
          <span className="rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-amber-400">
            {renderStars(explanation.confidenceStars)}
          </span>
          {explanation.factorLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="grid gap-2">
          {explanation.pillars.map((pillar) => (
            <div
              key={pillar.label}
              className="rounded-lg border border-border/40 bg-secondary/20 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{pillar.label}</span>
                <span className="text-xs text-amber-400">{renderStars(pillar.stars)}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border/40 bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
          {explanation.methodologyPreview}
        </div>
      </PopoverContent>
    </Popover>
  );
}

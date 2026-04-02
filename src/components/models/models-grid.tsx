import Link from "next/link";
import { Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { formatNumber } from "@/lib/format";
import { getLifecycleBadge } from "@/lib/models/lifecycle";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { getParameterDisplay } from "@/lib/models/presentation";
import { formatMarketValue } from "@/lib/models/market-value";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { ModelSignalBadge } from "@/components/models/model-signal-badge";
import type { ModelSignalSummary } from "@/lib/news/model-signals";

interface ModelsGridProps {
  models: Array<{
    id: string;
    slug: string;
    name: string;
    provider: string;
    category: string;
    status: string;
    overall_rank: number | null;
    quality_score: number | null;
    market_cap_estimate?: number | null;
    is_open_weights: boolean | null;
    parameter_count?: number | null;
    short_description?: string | null;
    description?: string | null;
    hf_downloads?: number | null;
    model_pricing?: Array<{
      provider_name?: string | null;
      input_price_per_million: number | null;
      source?: string | null;
      output_price_per_million?: number | null;
      currency?: string | null;
    }>;
    recent_signal?: ModelSignalSummary | null;
    access_offer?: {
      monthlyPriceLabel: string;
      actionLabel: string;
    } | null;
    managed_deployment_available?: boolean;
    usage_mode_labels?: string[] | null;
  }>;
}

export function ModelsGrid({ models }: ModelsGridProps) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => {
        const catConfig = CATEGORIES.find((c) => c.slug === model.category);
        const rank = model.overall_rank ?? 0;
        const parameterDisplay = getParameterDisplay(model);
        const pricingSummary = getPublicPricingSummary(model);
        const accessOffer = model.access_offer ?? null;
        const lifecycleBadge = getLifecycleBadge(model.status);
        const recentSignal = model.recent_signal ?? null;
        const managedDeploymentAvailable = model.managed_deployment_available ?? false;
        const usageModeLabels = model.usage_mode_labels ?? [];

        return (
          <Link key={model.id} href={`/models/${model.slug}`}>
            <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      rank <= 3 ? "text-neon" : "text-muted-foreground"
                    }`}
                  >
                    #{rank || "—"}
                  </span>
                  {catConfig && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-transparent text-[11px]"
                      style={{
                        backgroundColor: `${catConfig.color}15`,
                        color: catConfig.color,
                      }}
                    >
                      <catConfig.icon className="h-3 w-3" />
                      {catConfig.shortLabel}
                    </Badge>
                  )}
                </div>

                <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors">
                  {model.name}
                </h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <ProviderLogo provider={model.provider} size="sm" />
                  <p className="text-xs text-muted-foreground">{model.provider}</p>
                  {lifecycleBadge && !lifecycleBadge.rankedByDefault && (
                    <Badge variant="outline" className="text-[10px]">
                      {lifecycleBadge.label}
                    </Badge>
                  )}
                </div>

                {recentSignal ? (
                  <div className="mt-3">
                    <ModelSignalBadge signal={recentSignal} />
                  </div>
                ) : null}
                {managedDeploymentAvailable ? (
                  <div className="mt-3">
                    <Badge
                      variant="outline"
                      className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[10px] text-[#00d4aa]"
                    >
                      Use on This Site
                    </Badge>
                  </div>
                ) : null}
                {!managedDeploymentAvailable && usageModeLabels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {usageModeLabels.slice(0, 2).map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="border-border/30 text-[10px] text-muted-foreground"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
                  <div className="text-center">
                    <p className="text-lg font-bold tabular-nums">
                      {model.quality_score ? Number(model.quality_score).toFixed(1) : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium tabular-nums text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-neon" />
                        {parameterDisplay.label}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">Params</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium tabular-nums text-muted-foreground">
                      {accessOffer
                        ? accessOffer.monthlyPriceLabel
                        : pricingSummary.compactDisplay
                          ? pricingSummary.compactDisplay
                          : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {accessOffer ? accessOffer.actionLabel : pricingSummary.compactLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-muted-foreground">
                  Est. Value:{" "}
                  <span className="font-medium text-foreground">
                    {formatMarketValue(model.market_cap_estimate ?? null)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  {model.is_open_weights ? (
                    <Badge
                      variant="outline"
                      className="border-gain/30 bg-gain/10 text-[10px] text-gain"
                    >
                      Open Weights
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-border/30 text-[10px] text-muted-foreground"
                    >
                      Proprietary
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatNumber(model.hf_downloads)} downloads
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

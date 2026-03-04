import Link from "next/link";
import { Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { formatNumber, formatParams, formatTokenPrice } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";

interface ModelsGridProps {
  models: Array<{ id: string; slug: string; name: string; provider: string; category: string; overall_rank: number | null; quality_score: number | null; is_open_weights: boolean | null; parameter_count?: number | null; hf_downloads?: number | null; model_pricing?: Array<{ input_price_per_million: number | null }> }>;
}

export function ModelsGrid({ models }: ModelsGridProps) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => {
        const catConfig = CATEGORIES.find((c) => c.slug === model.category);
        const rank = model.overall_rank ?? 0;
        const cheapestPricing = (
          model.model_pricing as { input_price_per_million: number | null }[]
        )
          ?.filter((p) => p.input_price_per_million != null)
          .sort(
            (a, b) =>
              (a.input_price_per_million ?? 0) -
              (b.input_price_per_million ?? 0)
          )[0];

        return (
          <Link key={model.id} href={`/models/${model.slug}`}>
            <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
              <CardContent className="p-5">
                {/* Top row: rank + category */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      rank <= 3
                        ? "text-neon"
                        : "text-muted-foreground"
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

                {/* Name */}
                <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors">
                  {model.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ProviderLogo provider={model.provider} size="sm" />
                  <p className="text-xs text-muted-foreground">
                    {model.provider}
                  </p>
                </div>

                {/* Stats row */}
                <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
                  <div className="text-center">
                    <p className="text-lg font-bold tabular-nums">
                      {model.quality_score
                        ? Number(model.quality_score).toFixed(1)
                        : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium tabular-nums text-muted-foreground">
                      {model.parameter_count ? (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-neon" />
                          {formatParams(model.parameter_count)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Params</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium tabular-nums text-muted-foreground">
                      {cheapestPricing
                        ? `${formatTokenPrice(cheapestPricing.input_price_per_million)}/M`
                        : model.is_open_weights
                          ? "Free"
                          : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Price</p>
                  </div>
                </div>

                {/* Bottom: open weights + downloads */}
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

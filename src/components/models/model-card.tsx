import Link from "next/link";
import { Download, Heart, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RankBadge } from "@/components/shared/rank-badge";
import { CategoryBadge } from "@/components/shared/category-badge";
import { formatNumber, formatParams, formatTokenPrice } from "@/lib/format";
import type { Model, ModelPricing, Ranking } from "@/types/database";

interface ModelCardProps {
  model: Model & {
    rankings?: Ranking[];
    model_pricing?: ModelPricing[];
  };
}

export function ModelCard({ model }: ModelCardProps) {
  const overallRanking = model.rankings?.find(
    (r) => r.ranking_type === "overall"
  );
  const cheapestPricing = model.model_pricing
    ?.filter((p) => p.input_price_per_million != null)
    .sort((a, b) => (a.input_price_per_million ?? 0) - (b.input_price_per_million ?? 0))[0];

  return (
    <Link href={`/models/${model.slug}`}>
      <Card className="group relative overflow-hidden border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
        <CardContent className="p-4">
          {/* Top row: rank + category */}
          <div className="flex items-center justify-between">
            <RankBadge
              rank={overallRanking?.rank ?? model.overall_rank}
              previousRank={overallRanking?.previous_rank}
              size="sm"
            />
            <CategoryBadge category={model.category} size="sm" />
          </div>

          {/* Model name & provider */}
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-neon transition-colors truncate">
              {model.name}
            </h3>
            <p className="text-xs text-muted-foreground">{model.provider}</p>
          </div>

          {/* Description */}
          {model.short_description && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {model.short_description}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            {model.parameter_count && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-neon" />
                {formatParams(model.parameter_count)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {formatNumber(model.hf_downloads)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatNumber(model.hf_likes)}
            </span>
          </div>

          {/* Pricing */}
          {cheapestPricing && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/50 px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground">From</span>
              <span className="text-xs font-medium text-neon">
                {formatTokenPrice(cheapestPricing.input_price_per_million)} in /{" "}
                {formatTokenPrice(cheapestPricing.output_price_per_million)} out
              </span>
            </div>
          )}

          {/* Open weights badge */}
          {model.is_open_weights && (
            <div className="absolute right-3 top-3">
              <span className="rounded-full bg-gain/10 px-1.5 py-0.5 text-[10px] font-medium text-gain">
                Open
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

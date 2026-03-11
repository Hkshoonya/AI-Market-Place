import Link from "next/link";
import { ArrowRight } from "lucide-react";
// REMOVED: import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// REMOVED: import { CATEGORIES } from "@/lib/constants/categories";
// REMOVED: import { formatParams, formatNumber } from "@/lib/format";
import { formatParams } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";

interface SimilarModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  hf_downloads: number;
  parameter_count: number | null;
  is_open_weights: boolean;
}

interface SimilarModelsProps {
  models: SimilarModel[];
  currentCategory: string;
}

export function SimilarModels({ models, currentCategory }: SimilarModelsProps) {
  if (models.length === 0) return null;

  // REMOVED: const catConfig = CATEGORIES.find((c) => c.slug === currentCategory);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Similar Models
        </h3>
        <Button variant="ghost" size="sm" className="text-neon text-xs h-7" asChild>
          <Link href={`/models?category=${currentCategory}`}>
            View All <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
      <div className="space-y-1.5">
        {models.map((model) => (
          <Link
            key={model.id}
            href={`/models/${model.slug}`}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/30 group"
          >
            <ProviderLogo provider={model.provider} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate group-hover:text-neon transition-colors">
                  {model.name}
                </span>
                {model.overall_rank && (
                  <span className="text-[10px] font-bold text-neon">
                    #{model.overall_rank}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{model.provider}</span>
                {model.parameter_count && (
                  <>
                    <span>·</span>
                    <span>{formatParams(model.parameter_count)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {model.quality_score != null && (
                <span className="text-xs font-semibold tabular-nums">
                  {Number(model.quality_score).toFixed(1)}
                </span>
              )}
              {model.is_open_weights && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gain" title="Open Weights" />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

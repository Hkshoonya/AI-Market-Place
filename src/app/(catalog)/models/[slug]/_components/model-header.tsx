import { ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModelActions } from "@/components/models/model-actions";
import { ShareModel } from "@/components/models/share-model";
import { ModelSignalBadge } from "@/components/models/model-signal-badge";
import { ProviderLogo } from "@/components/shared/provider-logo";
import type { CategoryConfig } from "@/lib/constants/categories";
import type { ModelSignalSummary } from "@/lib/news/model-signals";

export interface ModelHeaderProps {
  name: string;
  provider: string;
  description: string | null;
  overall_rank: number | null;
  is_open_weights: boolean | null;
  website_url: string | null;
  slug: string;
  id: string;
  catConfig: CategoryConfig | undefined;
  recentSignal?: ModelSignalSummary | null;
}

export function ModelHeader({
  name,
  provider,
  description,
  overall_rank,
  is_open_weights,
  website_url,
  slug,
  id,
  catConfig,
  recentSignal,
}: ModelHeaderProps) {
  return (
    <div className="relative -mx-4 px-4 py-6 mb-2 rounded-2xl gradient-mesh">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{name}</h1>
            {overall_rank && (
              <Badge className="rank-badge text-sm text-neon font-bold">
                #{overall_rank}
              </Badge>
            )}
            {catConfig && (
              <Badge
                variant="outline"
                className="gap-1 border-transparent text-xs"
                style={{ backgroundColor: `${catConfig.color}15`, color: catConfig.color }}
              >
                <catConfig.icon className="h-3.5 w-3.5" />
                {catConfig.label}
              </Badge>
            )}
            {is_open_weights ? (
              <Badge variant="outline" className="border-gain/30 bg-gain/10 text-xs text-gain">
                Open Weights
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Proprietary
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ProviderLogo provider={provider} size="md" />
            <p className="text-lg text-muted-foreground">{provider}</p>
          </div>
          {recentSignal ? (
            <div className="mt-3">
              <ModelSignalBadge signal={recentSignal} />
            </div>
          ) : null}
          {description && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 md:flex-col">
          {website_url && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={website_url} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4" />
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          <ModelActions modelSlug={slug} modelName={name} modelId={id} />
          <ShareModel modelSlug={slug} modelName={name} provider={provider} />
        </div>
      </div>
    </div>
  );
}

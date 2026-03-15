import Link from "next/link";
import { Activity, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { z } from "zod";
import { parseQueryResultPartial } from "@/lib/schemas/parse";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { formatNumber, formatTokenPrice } from "@/lib/format";
import {
  compareModelsByLowestPrice,
  getPublicPricingSummary,
} from "@/lib/models/pricing";
import { getParameterDisplay } from "@/lib/models/presentation";
import {
  getLifecycleBadge,
  getLifecycleStatuses,
  parseLifecycleFilter,
} from "@/lib/models/lifecycle";
import { formatMarketValue } from "@/lib/models/market-value";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { ModelsFilterBar } from "@/components/models/models-filter-bar";
import { ModelsGrid } from "@/components/models/models-grid";
import { Pagination } from "@/components/models/pagination";
import { ProviderLogo } from "@/components/shared/provider-logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Models Directory",
  description: "Browse, search, and compare AI models from around the world.",
};
export const revalidate = 60;

const PAGE_SIZE = 20;

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    q?: string;
    view?: string;
    page?: string;
    open?: string;
    provider?: string;
    params?: string;
    api?: string;
    license?: string;
    lifecycle?: string;
  }>;
}) {
  const p = await searchParams;
  const category = p.category ?? "";
  const sort = p.sort ?? "rank";
  const query = p.q ?? "";
  const view = p.view ?? "list";
  const page = parseInt(p.page ?? "1", 10);
  const openOnly = p.open === "true";
  const providerFilter = p.provider ?? "";
  const paramsFilter = p.params ?? "";
  const apiFilter = p.api === "true";
  const licenseFilter = p.license ?? "";
  const lifecycleFilter = parseLifecycleFilter(p.lifecycle);

  const supabase = createPublicClient();

  let dbQuery = supabase
    .from("models")
    .select("*, rankings(*), model_pricing(*)", { count: "exact" });

  dbQuery =
    lifecycleFilter === "all"
      ? dbQuery.in("status", getLifecycleStatuses("all"))
      : dbQuery.eq("status", "active");

  if (category) {
    dbQuery = dbQuery.eq(
      "category",
      category as import("@/types/database").ModelCategory
    );
  }

  if (openOnly) {
    dbQuery = dbQuery.eq("is_open_weights", true);
  }

  if (providerFilter) {
    dbQuery = dbQuery.eq("provider", providerFilter);
  }

  if (paramsFilter) {
    const billion = 1_000_000_000;
    if (paramsFilter === "0-10") {
      dbQuery = dbQuery.lt("parameter_count", 10 * billion);
    } else if (paramsFilter === "10-70") {
      dbQuery = dbQuery.gte("parameter_count", 10 * billion).lt("parameter_count", 70 * billion);
    } else if (paramsFilter === "70-200") {
      dbQuery = dbQuery.gte("parameter_count", 70 * billion).lt("parameter_count", 200 * billion);
    } else if (paramsFilter === "200+") {
      dbQuery = dbQuery.gte("parameter_count", 200 * billion);
    }
  }

  if (apiFilter) {
    dbQuery = dbQuery.eq("is_api_available", true);
  }

  if (licenseFilter) {
    dbQuery = dbQuery.eq(
      "license",
      licenseFilter as import("@/types/database").LicenseType
    );
  }

  if (query) {
    const sanitizedQuery = sanitizeFilterValue(query);
    if (sanitizedQuery) {
      dbQuery = dbQuery.or(
        `name.ilike.%${sanitizedQuery}%,provider.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`
      );
    }
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const useInMemoryPriceSort = sort === "price";

  if (!useInMemoryPriceSort) {
    switch (sort) {
      case "downloads":
        dbQuery = dbQuery.order("hf_downloads", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "newest":
        dbQuery = dbQuery.order("release_date", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "quality":
        dbQuery = dbQuery.order("quality_score", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "rank":
      default:
        dbQuery = dbQuery.order("overall_rank", {
          ascending: true,
          nullsFirst: false,
        });
        break;
    }

    dbQuery = dbQuery.range(from, to);
  }

  const modelsResponse = await dbQuery;
  const count = modelsResponse.count;

  const ModelsPageSchema = ModelBaseSchema.extend({
    model_pricing: z
      .array(
        z.object({
          provider_name: z.string().nullable().optional(),
          input_price_per_million: z.number().nullable(),
          source: z.string().nullable().optional(),
          output_price_per_million: z.number().nullable().optional(),
          currency: z.string().nullable().optional(),
        })
      )
      .optional(),
  });

  const parsedModels = parseQueryResultPartial(
    modelsResponse,
    ModelsPageSchema,
    "ModelsPage"
  );

  const totalCount = count ?? parsedModels.length;
  const models = useInMemoryPriceSort
    ? [...parsedModels].sort(compareModelsByLowestPrice).slice(from, to + 1)
    : parsedModels;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">AI Models Directory</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Browse, search, and compare AI models from providers worldwide.
        </p>
        {lifecycleFilter === "active" && (
          <div className="mt-4 rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
            Default view ranks active models only. Preview, beta, deprecated, and archived
            models stay tracked and can be included with one click.
          </div>
        )}
      </div>

      <ModelsFilterBar totalCount={totalCount} />

      {models.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">No models found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : view === "grid" ? (
        <ModelsGrid models={models} />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Model
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">
                  Category
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                  Params
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Score
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                  Downloads
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                  Likes
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                  Cheapest Verified
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground xl:table-cell">
                  Est. Value
                </th>
                <th className="w-16 px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => {
                const catConfig = CATEGORIES.find((c) => c.slug === model.category);
                const rank = model.overall_rank ?? 0;
                const pricingSummary = getPublicPricingSummary(model);
                const parameterDisplay = getParameterDisplay(model);
                const lifecycleBadge = getLifecycleBadge(model.status);

                return (
                  <tr
                    key={model.id}
                    className="border-b border-border/30 transition-colors hover:bg-secondary/20 cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <Link href={`/models/${model.slug}`}>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            rank <= 3 ? "text-neon" : "text-muted-foreground"
                          }`}
                        >
                          {rank || "â€”"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/models/${model.slug}`}>
                        <div className="flex items-center gap-2">
                          <ProviderLogo provider={model.provider} size="sm" />
                          <div>
                            <span className="text-sm font-semibold hover:text-neon transition-colors">
                              {model.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {model.provider}
                            </span>
                            {lifecycleBadge && !lifecycleBadge.rankedByDefault && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                {lifecycleBadge.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
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
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                      <span className="flex items-center justify-end gap-1">
                        <Zap className="h-3 w-3 text-neon" />
                        {parameterDisplay.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold tabular-nums">
                        {model.quality_score ? Number(model.quality_score).toFixed(1) : "â€”"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                      {formatNumber(model.hf_downloads)}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground lg:table-cell">
                      {formatNumber(model.hf_likes)}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm lg:table-cell">
                      {pricingSummary.compactPrice != null ? (
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>
                            {pricingSummary.compactPrice === 0
                              ? "Free"
                              : `${formatTokenPrice(pricingSummary.compactPrice)}/M`}
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                            {pricingSummary.compactLabel}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">â€”</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground xl:table-cell">
                      {formatMarketValue(model.market_cap_estimate)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {model.is_open_weights ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-gain"
                          title="Open Weights"
                        />
                      ) : (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30"
                          title="Proprietary"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination totalCount={totalCount} pageSize={PAGE_SIZE} />
    </div>
  );
}

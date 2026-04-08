import { createPublicClient } from "@/lib/supabase/public-server";
import { pickBestModelSignals, type ModelSignalSummary } from "@/lib/news/model-signals";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import { CompareClient } from "./compare-client";

import type { ModelWithDetails } from "@/types/database";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants/site";
import type { CompareAccessOffer } from "./_components/compare-helpers";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";

export const revalidate = 3600;

export async function generateMetadata(props: {
  searchParams: Promise<{ models?: string }>;
}): Promise<Metadata> {
  const { models: modelsParam } = await props.searchParams;

  if (!modelsParam) {
    return {
      title: "Compare AI Models",
      description:
        "Side-by-side comparison of AI models across benchmarks, pricing, speed, and capabilities.",
      openGraph: {
        title: "Compare AI Models",
        description:
          "Side-by-side comparison of AI models across benchmarks, pricing, speed, and capabilities.",
        url: `${SITE_URL}/compare`,
      },
      alternates: {
        canonical: `${SITE_URL}/compare`,
      },
    };
  }

  const slugs = modelsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("models")
    .select("name")
    .in("slug", slugs)
    .eq("status", "active");

  const names = (data as { name: string }[] | null)?.map((m) => m.name) ?? slugs;
  const title = names.length > 0
    ? `Compare ${names.slice(0, 3).join(" vs ")}${names.length > 3 ? ` + ${names.length - 3} more` : ""}`
    : "Compare AI Models";

  return {
    title,
    description: `Side-by-side comparison of ${names.join(", ")} across benchmarks, pricing, speed, and capabilities on AI Market Cap.`,
    openGraph: {
      title,
      description: `Compare ${names.join(", ")} side by side.`,
    },
    alternates: {
      canonical: `${SITE_URL}/compare`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ models?: string }>;
}) {
  const { models: modelsParam } = await searchParams;
  const supabase = createPublicClient();

  // Fetch all models for the selector
  const { data: allModels } = await supabase
    .from("models")
    .select("id, slug, name, provider, category")
    .eq("status", "active")
    .order("overall_rank", { ascending: true, nullsFirst: false });

  const modelList = preferDefaultPublicSurfaceReady(
    ((allModels as {
      id: string;
      slug: string;
      name: string;
      provider: string;
      category: string;
    }[] | null) ?? []),
    12
  );

  // If specific models are requested via URL params, fetch their full data
  const selectedSlugs = modelsParam
    ? modelsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5)
    : [];

  let selectedModels: ModelWithDetails[] = [];
  let initialModelSignals: Record<string, ModelSignalSummary | null> = {};
  let initialAccessOffers: Record<string, CompareAccessOffer | null> = {};

  if (selectedSlugs.length > 0) {
    const [{ data }, { data: newsRaw }, { data: deploymentPlatformsRaw }, { data: modelDeploymentsRaw }] =
      await Promise.all([
        supabase
          .from("models")
          .select(
            `
            *,
            benchmark_scores(*, benchmarks(*)),
            model_pricing(*),
            elo_ratings(*),
            rankings(*)
          `
          )
          .in("slug", selectedSlugs)
          .eq("status", "active"),
        supabase
          .from("model_news")
          .select("id, title, source, related_provider, related_model_ids, published_at, metadata")
          .order("published_at", { ascending: false })
          .limit(200),
        supabase.from("deployment_platforms").select("*").order("name"),
        supabase
          .from("model_deployments")
          .select(
            "id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status"
          )
          .in("model_id", modelList
            .filter((model) => selectedSlugs.includes(model.slug))
            .map((model) => model.id)),
      ]);

    selectedModels = (data as ModelWithDetails[] | null) ?? [];

    const recentNewsItems = (newsRaw ?? []).map((item) => ({
      id: typeof item.id === "string" ? item.id : null,
      title: typeof item.title === "string" ? item.title : null,
      source: typeof item.source === "string" ? item.source : null,
      related_provider:
        typeof item.related_provider === "string" ? item.related_provider : null,
      related_model_ids: Array.isArray(item.related_model_ids)
        ? item.related_model_ids.filter((value): value is string => typeof value === "string")
        : null,
      published_at:
        typeof item.published_at === "string" ? item.published_at : null,
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null,
    }));
    const modelSignals = pickBestModelSignals(selectedModels, recentNewsItems);

    const deploymentPlatforms = (deploymentPlatformsRaw ?? []).map((platform) => {
      const platformRecord = platform as Record<string, unknown>;
      return {
        id: platform.id,
        slug: platform.slug,
        name: platform.name,
        type: platform.type,
        base_url: platform.base_url,
        has_affiliate: platform.has_affiliate,
        affiliate_url:
          typeof platformRecord.affiliate_url === "string"
            ? platformRecord.affiliate_url
            : platform.affiliate_url_template,
        affiliate_tag:
          typeof platformRecord.affiliate_tag === "string"
            ? platformRecord.affiliate_tag
            : null,
      };
    });

    const accessCatalog = buildAccessOffersCatalog({
      platforms: deploymentPlatforms,
      deployments: (modelDeploymentsRaw ?? []) as Array<{
        id: string;
        model_id: string;
        platform_id: string;
        pricing_model: string | null;
        price_per_unit: number | null;
        unit_description: string | null;
        free_tier: string | null;
        one_click: boolean;
        status?: string | null;
      }>,
      models: selectedModels.map((model) => ({
        id: model.id,
        slug: model.slug,
        name: model.name,
        provider: model.provider,
        category: model.category,
        quality_score: model.quality_score,
        capability_score: model.capability_score,
        adoption_score: model.adoption_score,
        economic_footprint_score: model.economic_footprint_score,
      })),
    });

    initialModelSignals = Object.fromEntries(
      selectedModels.map((model) => [model.slug, modelSignals.get(model.id) ?? null])
    );
    initialAccessOffers = Object.fromEntries(
      selectedModels.map((model) => {
        const accessOffer = getBestAccessOfferForModel(accessCatalog, model.id);
        return [
          model.slug,
          accessOffer
            ? {
                monthlyPriceLabel: accessOffer.monthlyPriceLabel,
                actionLabel: accessOffer.actionLabel,
              }
            : null,
        ];
      })
    );
  }

  return (
    <CompareClient
      allModels={modelList}
      initialModels={selectedModels}
      initialSlugs={selectedSlugs}
      initialModelSignals={initialModelSignals}
      initialAccessOffers={initialAccessOffers}
    />
  );
}

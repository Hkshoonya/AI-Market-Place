import { createPublicClient } from "@/lib/supabase/public-server";
import { CompareClient } from "./compare-client";

import type { ModelWithDetails } from "@/types/database";
import type { Metadata } from "next";

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

  const modelList = (allModels as { id: string; slug: string; name: string; provider: string; category: string }[] | null) ?? [];

  // If specific models are requested via URL params, fetch their full data
  const selectedSlugs = modelsParam
    ? modelsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5)
    : [];

  let selectedModels: ModelWithDetails[] = [];

  if (selectedSlugs.length > 0) {
    const { data } = await supabase
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
      .eq("status", "active");

    selectedModels = (data as ModelWithDetails[] | null) ?? [];
  }

  return (
    <CompareClient
      allModels={modelList}
      initialModels={selectedModels}
      initialSlugs={selectedSlugs}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { CompareClient } from "./compare-client";

export const revalidate = 3600;

export const metadata = {
  title: "Compare AI Models | AI Market Cap",
  description:
    "Side-by-side comparison of AI models across benchmarks, pricing, speed, and capabilities.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ models?: string }>;
}) {
  const { models: modelsParam } = await searchParams;
  const supabase = await createClient();

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

  let selectedModels: Record<string, unknown>[] = [];

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

    selectedModels = (data as Record<string, unknown>[] | null) ?? [];
  }

  return (
    <CompareClient
      allModels={modelList}
      initialModels={selectedModels}
      initialSlugs={selectedSlugs}
    />
  );
}

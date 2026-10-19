import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-server";

// Public chart data only. Model IDs are part of the cache key; no session is read.
export const getPublicModelSnapshots = unstable_cache(async (modelId: string) => {
  const { data, error } = await createPublicClient()
    .from("model_snapshots")
    .select("snapshot_date, quality_score, hf_downloads, hf_likes, overall_rank")
    .eq("model_id", modelId)
    .order("snapshot_date", { ascending: true });
  if (error || !data) throw new Error("Unable to load public model history");
  return data;
}, ["public-model-snapshots-v1"], { revalidate: 300 });

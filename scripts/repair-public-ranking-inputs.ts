import "dotenv/config";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripPublicRankingInputs } from "@/lib/models/public-ranking-inputs";
import { getDefaultPublicSurfaceReadinessBlockers } from "@/lib/models/public-surface-readiness";

const PAGE_SIZE = 500;

type ModelRow = {
  id: string;
  slug: string;
  provider: string | null;
  name: string | null;
  category: string | null;
  release_date: string | null;
  is_open_weights: boolean | null;
  license: string | null;
  license_name: string | null;
  context_window: number | null;
  overall_rank: number | null;
  popularity_score: number | null;
  adoption_score: number | null;
  quality_score: number | null;
  value_score: number | null;
  economic_footprint_score: number | null;
  market_cap_estimate: number | null;
  popularity_rank: number | null;
  adoption_rank: number | null;
  agent_score: number | null;
  agent_rank: number | null;
  capability_score: number | null;
  capability_rank: number | null;
  economic_footprint_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
  hf_trending_score: number | null;
};

async function main() {
  const supabase = createAdminClient();
  const candidates: ModelRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("models")
      .select(
        "id, slug, provider, name, category, release_date, is_open_weights, license, license_name, context_window, overall_rank, popularity_score, adoption_score, quality_score, value_score, economic_footprint_score, market_cap_estimate, popularity_rank, adoption_rank, agent_score, agent_rank, capability_score, capability_rank, economic_footprint_rank, usage_score, usage_rank, expert_score, expert_rank, balanced_rank, hf_trending_score"
      )
      .eq("status", "active")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch candidate models: ${error.message}`);
    }

    const page = (data ?? []) as ModelRow[];
    for (const row of page) {
      const blockers = getDefaultPublicSurfaceReadinessBlockers({
        slug: row.slug,
        provider: row.provider,
        name: row.name,
        category: row.category,
        release_date: row.release_date,
        is_open_weights: row.is_open_weights,
        license: row.license,
        license_name: row.license_name,
        context_window: row.context_window,
        overall_rank: row.overall_rank,
        capability_score: row.capability_score,
        quality_score: row.quality_score,
        adoption_score: row.adoption_score,
        popularity_score: row.popularity_score,
        economic_footprint_score: row.economic_footprint_score,
        hf_trending_score: row.hf_trending_score,
      });

      if (blockers.length === 0) continue;
      candidates.push(row);
    }

    if (page.length < PAGE_SIZE) break;
  }

  let repaired = 0;
  for (const row of candidates) {
    const sanitized = stripPublicRankingInputs(row);
    const { error } = await supabase
      .from("models")
      .update({
        overall_rank: sanitized.overall_rank,
        popularity_score: sanitized.popularity_score,
        adoption_score: sanitized.adoption_score,
        quality_score: sanitized.quality_score,
        value_score: sanitized.value_score,
        economic_footprint_score: sanitized.economic_footprint_score,
        market_cap_estimate: sanitized.market_cap_estimate,
        popularity_rank: sanitized.popularity_rank,
        adoption_rank: sanitized.adoption_rank,
        agent_score: sanitized.agent_score,
        agent_rank: sanitized.agent_rank,
        capability_score: sanitized.capability_score,
        capability_rank: sanitized.capability_rank,
        economic_footprint_rank: sanitized.economic_footprint_rank,
        usage_score: sanitized.usage_score,
        usage_rank: sanitized.usage_rank,
        expert_score: sanitized.expert_score,
        expert_rank: sanitized.expert_rank,
        balanced_rank: sanitized.balanced_rank,
        hf_trending_score: sanitized.hf_trending_score,
      })
      .eq("id", row.id);

    if (error) {
      throw new Error(`Failed to repair ${row.slug}: ${error.message}`);
    }
    repaired += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: candidates.length,
        repaired,
      },
      null,
      2
    )
  );
}

void main();

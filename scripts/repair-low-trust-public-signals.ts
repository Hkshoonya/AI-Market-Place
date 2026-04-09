import "dotenv/config";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPublicSourceTrustTier,
  isLowTrustPublicSourceTier,
} from "@/lib/models/public-source-trust";
import {
  hasPublicSignalInputs,
  stripPublicSignalInputs,
} from "@/lib/models/public-signal-inputs";

const PAGE_SIZE = 500;

type ModelRow = {
  id: string;
  slug: string;
  provider: string | null;
  hf_model_id: string | null;
  website_url: string | null;
  hf_downloads: number | null;
  hf_likes: number | null;
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
        "id, slug, provider, hf_model_id, website_url, hf_downloads, hf_likes, hf_trending_score"
      )
      .eq("status", "active")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch candidate models: ${error.message}`);
    }

    const page = (data ?? []) as ModelRow[];
    for (const row of page) {
      const trustTier = getPublicSourceTrustTier(row);
      if (!isLowTrustPublicSourceTier(trustTier)) continue;
      if (!hasPublicSignalInputs(row)) continue;
      candidates.push(row);
    }

    if (page.length < PAGE_SIZE) break;
  }

  let repaired = 0;
  for (const row of candidates) {
    const sanitized = stripPublicSignalInputs(row);
    const { error } = await supabase
      .from("models")
      .update({
        hf_downloads: sanitized.hf_downloads,
        hf_likes: sanitized.hf_likes,
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

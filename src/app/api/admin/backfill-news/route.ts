import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildModelLookup,
  resolveNewsRelations,
} from "@/lib/data-sources/model-matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * Backfill endpoint — populate related_model_ids for existing news items.
 *
 * POST /api/admin/backfill-news
 * Authorization: Bearer <CRON_SECRET>
 *
 * Fetches all model_news rows with NULL related_model_ids,
 * runs the model name matcher against each title/summary,
 * and batch-updates the related_model_ids + related_provider columns.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Build model lookup table (single query, ~730 models)
    const lookup = await buildModelLookup(supabase);
    if (lookup.length === 0) {
      return NextResponse.json(
        { error: "No models found for matching" },
        { status: 500 }
      );
    }

    // 2. Fetch news items that need backfilling (NULL related_model_ids)
    const BATCH_SIZE = 200;
    let totalProcessed = 0;
    let totalLinked = 0;
    let totalModelsLinked = 0;
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const { data: newsItems, error } = await supabase
        .from("model_news")
        .select("id, title, summary, metadata, related_provider")
        .is("related_model_ids", null)
        .order("published_at", { ascending: false })
        .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

      if (error) {
        return NextResponse.json(
          { error: `Fetch failed: ${error.message}` },
          { status: 500 }
        );
      }

      if (!newsItems || newsItems.length === 0) {
        hasMore = false;
        break;
      }

      // 3. Process each news item
      const updates: Array<{
        id: string;
        related_model_ids: string[];
        related_provider: string | null;
      }> = [];

      for (const item of newsItems) {
        const { modelIds, provider } = resolveNewsRelations(
          item.title,
          item.summary,
          item.metadata as Record<string, unknown> | null,
          lookup
        );

        // Always set related_model_ids (empty array if no matches)
        // This prevents re-processing on subsequent runs
        updates.push({
          id: item.id,
          related_model_ids: modelIds,
          related_provider: provider ?? item.related_provider ?? null,
        });

        if (modelIds.length > 0) {
          totalLinked++;
          totalModelsLinked += modelIds.length;
        }
      }

      // 4. Batch update
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("model_news")
          .update({
            related_model_ids: update.related_model_ids,
            related_provider: update.related_provider,
          })
          .eq("id", update.id);

        if (updateError) {
          console.error(
            `[backfill-news] Failed to update ${update.id}:`,
            updateError.message
          );
        }
      }

      totalProcessed += newsItems.length;
      page++;

      // Stop if we got fewer than a full batch
      if (newsItems.length < BATCH_SIZE) {
        hasMore = false;
      }

      // Safety limit: max 2000 items per run
      if (totalProcessed >= 2000) {
        hasMore = false;
      }
    }

    return NextResponse.json({
      ok: true,
      totalProcessed,
      totalLinked,
      totalModelsLinked,
      lookupSize: lookup.length,
      message: `Backfilled ${totalLinked}/${totalProcessed} news items with model links (${totalModelsLinked} total model associations)`,
    });
  } catch (err) {
    console.error("[backfill-news] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Hugging Face Model Sync Edge Function
// Fetches model data from HF API and upserts into Supabase
// Triggered by pg_cron every 6 hours

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HF_API_TOKEN = Deno.env.get("HUGGINGFACE_API_TOKEN") ?? "";

const HF_API_BASE = "https://huggingface.co/api";
const MAX_PAGES = 50; // 50 pages * 100 models = 5,000 models
const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 200; // ms between requests

// Map HF pipeline_tag to our category
function mapCategory(pipelineTag: string | null): string {
  const mapping: Record<string, string> = {
    "text-generation": "llm",
    "text2text-generation": "llm",
    "conversational": "llm",
    "fill-mask": "llm",
    "summarization": "llm",
    "translation": "llm",
    "question-answering": "llm",
    "text-to-image": "image_generation",
    "image-to-image": "image_generation",
    "image-classification": "vision",
    "object-detection": "vision",
    "image-segmentation": "vision",
    "image-to-text": "vision",
    "visual-question-answering": "multimodal",
    "document-question-answering": "multimodal",
    "feature-extraction": "embeddings",
    "sentence-similarity": "embeddings",
    "automatic-speech-recognition": "speech_audio",
    "text-to-speech": "speech_audio",
    "audio-classification": "speech_audio",
    "text-to-video": "video",
    "video-classification": "video",
    "text-to-code": "code",
  };
  return mapping[pipelineTag ?? ""] ?? "specialized";
}

// Map HF license tag to our license type
function mapLicense(tags: string[]): { type: string; name: string } {
  const licenseTags = tags.filter(
    (t) =>
      t.startsWith("license:") ||
      t === "mit" ||
      t === "apache-2.0" ||
      t === "openrail"
  );

  for (const tag of licenseTags) {
    const license = tag.replace("license:", "");
    if (
      ["mit", "apache-2.0", "bsd-3-clause", "cc-by-4.0", "cc0-1.0", "openrail"].includes(license)
    ) {
      return { type: "open_source", name: license };
    }
    if (["cc-by-nc-4.0", "cc-by-nc-sa-4.0", "openrail++"].includes(license)) {
      return { type: "research_only", name: license };
    }
  }
  return { type: "commercial", name: "proprietary" };
}

// Generate a URL-safe slug from model ID
function makeSlug(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Extract parameter count from model tags or config
function extractParamCount(tags: string[]): number | null {
  for (const tag of tags) {
    // Tags like "7b", "13b", "70b", "1.5b"
    const match = tag.match(/^(\d+\.?\d*)(b|m|k)$/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === "b") return Math.round(num * 1_000_000_000);
      if (unit === "m") return Math.round(num * 1_000_000);
      if (unit === "k") return Math.round(num * 1_000);
    }
  }
  return null;
}

interface HFModel {
  id: string; // "meta-llama/Llama-3-70B"
  modelId: string;
  author: string;
  sha: string;
  lastModified: string;
  private: boolean;
  disabled: boolean;
  gated: boolean | string;
  pipeline_tag: string | null;
  tags: string[];
  downloads: number;
  likes: number;
  trendingScore: number;
  library_name: string;
  createdAt: string;
}

async function supabaseRequest(
  path: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "resolution=merge-duplicates" : "",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    return res.json();
  }
  return null;
}

async function fetchHFModels(page: number): Promise<HFModel[]> {
  const url = `${HF_API_BASE}/models?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&sort=trendingScore&direction=-1&full=true`;
  const headers: Record<string, string> = {};
  if (HF_API_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_API_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HF API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function transformModel(hf: HFModel) {
  const slug = makeSlug(hf.id);
  const [provider, ...nameParts] = hf.id.split("/");
  const name = nameParts.join("/") || hf.id;
  const category = mapCategory(hf.pipeline_tag);
  const license = mapLicense(hf.tags);
  const paramCount = extractParamCount(hf.tags);

  const isOpenWeights =
    license.type === "open_source" ||
    license.type === "research_only" ||
    hf.tags.includes("open_access");

  return {
    slug,
    name,
    provider: provider || "unknown",
    category,
    status: hf.disabled ? "archived" : "active",
    architecture: hf.library_name || null,
    parameter_count: paramCount,
    hf_model_id: hf.id,
    hf_downloads: hf.downloads || 0,
    hf_likes: hf.likes || 0,
    hf_trending_score: hf.trendingScore || 0,
    license: license.type,
    license_name: license.name,
    is_open_weights: isOpenWeights,
    is_api_available: false,
    supported_languages: JSON.stringify([]),
    modalities: JSON.stringify(
      hf.pipeline_tag ? [hf.pipeline_tag] : []
    ),
    capabilities: JSON.stringify({}),
    release_date: hf.createdAt ? hf.createdAt.split("T")[0] : null,
    data_refreshed_at: new Date().toISOString(),
  };
}

Deno.serve(async (_req) => {
  try {
    console.log("Starting Hugging Face sync...");

    // Create sync job record
    const syncJob = {
      source: "huggingface",
      job_type: "incremental",
      status: "running",
      started_at: new Date().toISOString(),
      metadata: JSON.stringify({ max_pages: MAX_PAGES, page_size: PAGE_SIZE }),
    };

    await supabaseRequest("sync_jobs", "POST", syncJob);

    let totalProcessed = 0;
    let totalCreated = 0;
    // REMOVED: const totalUpdated = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const models = await fetchHFModels(page);
        if (models.length === 0) break;

        // Transform all models in this batch
        const records = models
          .filter((m) => !m.private && !m.disabled)
          .map(transformModel);

        // Upsert batch into Supabase (using slug as conflict column)
        if (records.length > 0) {
          await supabaseRequest(
            "models?on_conflict=slug",
            "POST",
            records,
            { Prefer: "resolution=merge-duplicates" }
          );
        }

        totalProcessed += models.length;
        totalCreated += records.length; // Simplified — would need diff logic for accurate count

        console.log(
          `Page ${page + 1}/${MAX_PAGES}: processed ${models.length} models (total: ${totalProcessed})`
        );

        // Rate limit courtesy
        await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
      } catch (pageError) {
        console.error(`Error on page ${page}:`, pageError);
        // Continue with next page rather than failing entirely
      }
    }

    // Update sync job as completed
    console.log(
      `Sync complete: ${totalProcessed} processed, ${totalCreated} upserted`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        records_processed: totalProcessed,
        records_upserted: totalCreated,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

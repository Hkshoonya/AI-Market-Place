import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";

/**
 * Civitai Adapter — Community diffusion model hub
 *
 * API: GET https://civitai.com/api/v1/models
 * Returns checkpoints, LoRAs, and other diffusion model assets.
 */

const CIVITAI_API = "https://civitai.com/api/v1/models";

interface CivitaiModel {
  id: number;
  name: string;
  description: string | null;
  type: string; // "Checkpoint", "LORA", "TextualInversion", etc.
  nsfw: boolean;
  tags: string[];
  creator: { username: string };
  stats: {
    downloadCount: number;
    favoriteCount: number;
    commentCount: number;
    ratingCount: number;
    rating: number;
  };
  modelVersions?: {
    name: string;
    baseModel?: string;
    createdAt?: string;
  }[];
}

const adapter: DataSourceAdapter = {
  id: "civitai",
  name: "Civitai",
  outputTypes: ["models"],
  defaultConfig: {
    limit: 100,
    sort: "Newest",
    types: "Checkpoint",
    nsfw: false,
  },
  requiredSecrets: ["CIVITAI_API_KEY"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const limit = (ctx.config.limit as number) ?? 100;
    const sort = (ctx.config.sort as string) ?? "Newest";
    const types = (ctx.config.types as string) ?? "Checkpoint";
    const nsfw = (ctx.config.nsfw as boolean) ?? false;
    const errors: { message: string; context?: string }[] = [];

    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      types,
      nsfw: String(nsfw),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (ctx.secrets.CIVITAI_API_KEY) {
      headers["Authorization"] = `Bearer ${ctx.secrets.CIVITAI_API_KEY}`;
    }

    let recordsProcessed = 0;

    try {
      const res = await fetchWithRetry(
        `${CIVITAI_API}?${params.toString()}`,
        { headers },
        { signal: ctx.signal }
      );

      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `Civitai API returned ${res.status}` }],
        };
      }

      const data = await res.json();
      const models = (data.items ?? []) as CivitaiModel[];
      recordsProcessed = models.length;

      const records = models.map((m) => {
        const latestVersion = m.modelVersions?.[0];
        const baseModel = latestVersion?.baseModel ?? "";

        return {
          slug: makeSlug(`civitai-${m.id}-${m.name}`),
          name: m.name,
          provider: m.creator?.username ?? "civitai",
          category: "image_generation" as const,
          status: "active",
          description: (m.description ?? "").replace(/<[^>]*>/g, "").slice(0, 500),
          hf_downloads: m.stats?.downloadCount ?? 0,
          hf_likes: m.stats?.favoriteCount ?? 0,
          license: "open_source",
          license_name: "civitai",
          is_open_weights: true,
          is_api_available: false,
          architecture: baseModel || null,
          release_date: latestVersion?.createdAt?.split("T")[0] ?? null,
          data_refreshed_at: new Date().toISOString(),
          supported_languages: [],
          modalities: ["text-to-image"],
          capabilities: {},
        };
      });

      if (records.length > 0) {
        const { errors: ue } = await upsertBatch(
          ctx.supabase,
          "models",
          records,
          "slug"
        );
        errors.push(...ue);
      }
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err) });
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated: recordsProcessed,
      recordsUpdated: 0,
      errors,
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${CIVITAI_API}?limit=1`);
      return { healthy: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Failed",
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;

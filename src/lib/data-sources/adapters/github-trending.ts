import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch, sleep } from "../utils";
import { sanitizeFilterValue, sanitizeSlug } from "@/lib/utils/sanitize";
import { inferCategory } from "../shared/infer-category";

/**
 * GitHub Trending ML Repos Adapter
 *
 * Uses the GitHub Search API to find recently created/popular ML repositories.
 * Enriches existing models with github_url, or creates new entries for notable repos.
 */

const GITHUB_SEARCH_API = "https://api.github.com/search/repositories";

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  license: { spdx_id: string } | null;
}

const adapter: DataSourceAdapter = {
  id: "github-trending",
  name: "GitHub Trending",
  outputTypes: ["models"],
  defaultConfig: {
    language: "python",
    topic: "machine-learning",
    minStars: 100,
    maxResults: 50,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const topic = (ctx.config.topic as string) ?? "machine-learning";
    const language = (ctx.config.language as string) ?? "python";
    const minStars = (ctx.config.minStars as number) ?? 100;
    const maxResults = (ctx.config.maxResults as number) ?? 50;
    const errors: { message: string; context?: string }[] = [];

    // Search for recently popular ML repos (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const query = `topic:${topic}+language:${language}+stars:>=${minStars}+pushed:>${thirtyDaysAgo}`;
    const url = `${GITHUB_SEARCH_API}?q=${query}&sort=stars&order=desc&per_page=${maxResults}`;

    let recordsProcessed = 0;

    try {
      const res = await fetchWithRetry(
        url,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "AI-Market-Cap-Bot",
          },
        },
        { signal: ctx.signal }
      );

      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `GitHub API returned ${res.status}: ${await res.text()}` }],
        };
      }

      const data = await res.json();
      const repos = (data.items ?? []) as GitHubRepo[];
      recordsProcessed = repos.length;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = ctx.supabase as any;

      // First try to enrich existing models with github_url
      for (const repo of repos) {
        const repoSlug = makeSlug(repo.full_name);

        // Check if we already have this model
        const { data: existing } = await sb
          .from("models")
          .select("id, github_url")
          .or(`slug.eq.${sanitizeSlug(repoSlug)},name.ilike.%${sanitizeFilterValue(repo.name)}%`)
          .limit(1);

        if (existing?.[0] && !existing[0].github_url) {
          // Enrich existing model with github URL
          await sb
            .from("models")
            .update({
              github_url: repo.html_url,
              data_refreshed_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);
        }

        // Rate limit: GitHub has 10 req/min unauthenticated
        await sleep(100);
      }

      // Create new model entries for high-star repos not yet tracked
      const newModels = repos
        .filter((r) => r.stargazers_count >= 500) // Only notable repos
        .map((repo) => ({
          slug: makeSlug(repo.full_name),
          name: repo.name,
          provider: repo.owner.login,
          category: inferCategory({ mode: "topics", topics: repo.topics, description: repo.description ?? "" }),
          status: "active",
          description: (repo.description ?? "").slice(0, 500),
          github_url: repo.html_url,
          hf_downloads: repo.stargazers_count, // Use stars as popularity proxy
          license: repo.license?.spdx_id === "MIT" || repo.license?.spdx_id === "Apache-2.0"
            ? "open_source"
            : "custom",
          license_name: repo.license?.spdx_id ?? "unknown",
          is_open_weights: true,
          is_api_available: false,
          release_date: repo.created_at.split("T")[0],
          data_refreshed_at: new Date().toISOString(),
          supported_languages: [],
          modalities: [],
          capabilities: {},
        }));

      if (newModels.length > 0) {
        const { errors: ue } = await upsertBatch(
          ctx.supabase,
          "models",
          newModels,
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
      const res = await fetch(
        `${GITHUB_SEARCH_API}?q=topic:machine-learning&per_page=1`,
        { headers: { "User-Agent": "AI-Market-Cap-Bot" } }
      );
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

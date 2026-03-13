/**
 * GitHub Stars Adapter
 *
 * Fetches star and fork counts from the GitHub API for models
 * that have a github_url set in the database.
 *
 * Updates github_stars and github_forks columns on the models table.
 * Handles rate limiting by breaking on 403 responses.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  SyncError,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";

interface GitHubModelRecord {
  id: string;
  name: string;
  slug: string;
  github_url: string | null;
}

/** Extract owner/repo from a GitHub URL */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("github.com")) return null;

    // Handle paths like /owner/repo, /owner/repo/tree/main, etc.
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    return { owner: segments[0], repo: segments[1] };
  } catch {
    return null;
  }
}

interface GitHubRepoResponse {
  stargazers_count: number;
  forks_count: number;
  message?: string;
}

const CANONICAL_REPO_OVERRIDES: Record<string, string> = {
  "meta-llama-4-maverick": "https://github.com/meta-llama/llama-models",
};

function resolveGitHubSourceUrl(model: Pick<GitHubModelRecord, "slug" | "github_url">): string | null {
  return CANONICAL_REPO_OVERRIDES[model.slug] ?? model.github_url ?? null;
}

async function updateGithubFields(
  supabase: SyncContext["supabase"],
  modelId: string,
  values: Record<string, unknown>
): Promise<SyncError | null> {
  const { error } = await supabase
    .from("models")
    .update(values)
    .eq("id", modelId);

  if (!error) return null;
  return {
    message: `DB update failed for ${modelId}: ${error.message}`,
    context: "db_error",
  };
}

const adapter: DataSourceAdapter = {
  id: "github-stars",
  name: "GitHub Stars",
  outputTypes: ["models"],
  defaultConfig: {
    /** Delay between API calls in ms to respect rate limits */
    delayMs: 500,
  },
  requiredSecrets: ["GITHUB_TOKEN"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const supabase = ctx.supabase;
    const delayMs = (ctx.config.delayMs as number) ?? 500;
    const githubToken = ctx.secrets?.GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";

    let recordsProcessed = 0;
    const recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: SyncError[] = [];
    const warnings: SyncError[] = [];
    let canonicalRepoCorrections = 0;
    let staleMetricsCleared = 0;

    // Fetch all models with a github_url
    const { data: models, error: fetchError } = await supabase
      .from("models")
      .select("id, name, slug, github_url")
      .eq("status", "active")
      .not("github_url", "is", null);

    if (fetchError) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `Failed to fetch models: ${fetchError.message}` }],
      };
    }

    if (!models || models.length === 0) {
      return {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [],
        metadata: { message: "No models with github_url found" },
      };
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "AI-Market-Cap-Bot",
    };
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    for (const model of models as GitHubModelRecord[]) {
      recordsProcessed++;

      const githubSourceUrl = resolveGitHubSourceUrl(model);
      const parsed = parseGitHubUrl(githubSourceUrl ?? "");
      if (!parsed) {
        warnings.push({ message: `Invalid GitHub URL for ${model.slug}: ${model.github_url}` });
        const clearError = await updateGithubFields(supabase, model.id, {
          github_stars: null,
          github_forks: null,
        });
        if (clearError) {
          errors.push(clearError);
        } else {
          staleMetricsCleared++;
          recordsUpdated++;
        }
        continue;
      }

      try {
        const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
        const res = await fetch(apiUrl, { headers, signal: ctx.signal });

        // Rate limit hit - stop processing
        if (res.status === 403) {
          const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
          errors.push({
            message: `GitHub rate limit hit (remaining: ${rateLimitRemaining}). Stopping.`,
            context: "rate_limit",
          });
          break;
        }

        if (res.status === 404) {
          warnings.push({ message: `Repo not found: ${parsed.owner}/${parsed.repo}` });
          const clearError = await updateGithubFields(supabase, model.id, {
            github_stars: null,
            github_forks: null,
          });
          if (clearError) {
            errors.push(clearError);
          } else {
            staleMetricsCleared++;
            recordsUpdated++;
          }
          continue;
        }

        if (!res.ok) {
          errors.push({ message: `GitHub API ${res.status} for ${parsed.owner}/${parsed.repo}` });
          continue;
        }

        const data: GitHubRepoResponse = await res.json();

        const updatePayload: Record<string, unknown> = {
          github_stars: data.stargazers_count,
          github_forks: data.forks_count,
        };
        if (githubSourceUrl && githubSourceUrl !== model.github_url) {
          updatePayload.github_url = githubSourceUrl;
        }

        const updateError = await updateGithubFields(supabase, model.id, updatePayload);
        if (updateError) {
          errors.push(updateError);
        } else {
          if (githubSourceUrl && githubSourceUrl !== model.github_url) {
            canonicalRepoCorrections++;
          }
          recordsUpdated++;
        }

        // Respect rate limits
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      } catch (e) {
        errors.push({
          message: `Fetch error for ${model.slug}: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    return {
      success: errors.filter((e) => e.context === "rate_limit").length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated,
      errors,
      metadata: {
        modelsWithGithubUrl: models.length,
        warningCount: warnings.length,
        warningsSample: warnings.slice(0, 10).map((warning) => warning.message),
        canonicalRepoCorrections,
        staleMetricsCleared,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const token = secrets?.GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "AI-Market-Cap-Bot",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("https://api.github.com/rate_limit", { headers });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        const data = await res.json();
        const remaining = data?.resources?.core?.remaining ?? "unknown";
        return {
          healthy: true,
          latencyMs,
          message: `GitHub API reachable. Rate limit remaining: ${remaining}`,
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `GitHub API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `GitHub API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export const __testables = {
  parseGitHubUrl,
  resolveGitHubSourceUrl,
};
export default adapter;

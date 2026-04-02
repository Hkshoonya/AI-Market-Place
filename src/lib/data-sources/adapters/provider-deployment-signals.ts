import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";
import {
  buildModelLookup,
  limitProviderScopedModelIds,
  resolveNewsRelations,
  type ModelLookupEntry,
} from "../model-matcher";
import {
  buildModelAliasIndex,
  fetchAllActiveAliasModels,
  resolveAliasFamilyModelIds,
} from "../model-alias-resolver";

interface ProviderDeploymentSource {
  id: string;
  provider: string;
  url: string;
  titleHint: string;
  modelHints: string[];
  signalType: "open_source" | "api";
  summaryHint: string;
}

const PROVIDER_PAGE_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

const PROVIDER_DEPLOYMENT_SOURCES: ProviderDeploymentSource[] = [
  {
    id: "minimax-m2-open-source",
    provider: "MiniMax",
    url: "https://www.minimax.io/news/minimax-m2",
    titleHint: "MiniMax M2 open-source deployment update",
    modelHints: ["MiniMax M2", "MiniMax M2.1", "MiniMax M2.5"],
    signalType: "open_source",
    summaryHint:
      "MiniMax says the M2 family is open-sourced with official self-host guidance for private deployment using runtimes like vLLM and SGLang.",
  },
  {
    id: "minimax-m1-open-source",
    provider: "MiniMax",
    url: "https://www.minimax.io/news/minimaxm1",
    titleHint: "MiniMax M1 open-source deployment update",
    modelHints: ["MiniMax M1", "MiniMax M1 80K"],
    signalType: "open_source",
    summaryHint:
      "MiniMax says the M1 family is open-sourced and supported for self-host deployment workflows.",
  },
  {
    id: "minimax-text-models",
    provider: "MiniMax",
    url: "https://www.minimax.io/models/text",
    titleHint: "MiniMax text model deployment options",
    modelHints: ["MiniMax M2.5", "MiniMax M2.7", "MiniMax M1"],
    signalType: "open_source",
    summaryHint:
      "MiniMax text model docs describe which families are open weights and which support private cluster deployment or local serving.",
  },
  {
    id: "moonshot-kimi-agents-setup",
    provider: "Moonshot AI",
    url: "https://platform.moonshot.ai/blog/posts/coding_with_kimi_agents_setup",
    titleHint: "Kimi coding tool setup",
    modelHints: ["Kimi K2", "Kimi K2.5"],
    signalType: "api",
    summaryHint:
      "Moonshot documents first-party setup for using Kimi in local coding tools and agent workflows through the official API.",
  },
  {
    id: "moonshot-agent-support",
    provider: "Moonshot AI",
    url: "https://platform.moonshot.ai/docs/guide/agent-support.en-US",
    titleHint: "Kimi agent support guide",
    modelHints: ["Kimi K2.5"],
    signalType: "api",
    summaryHint:
      "Moonshot documents how Kimi models plug into local programming and agent tools through the official platform.",
  },
  {
    id: "zai-devpack-overview",
    provider: "Z.ai",
    url: "https://docs.z.ai/devpack/overview",
    titleHint: "GLM coding plan deployment guide",
    modelHints: ["GLM-5", "GLM-4.7", "GLM-4.6", "GLM-4.5"],
    signalType: "api",
    summaryHint:
      "Z.ai documents GLM deployment through its coding plan and local-tool workflow integrations for programming assistants.",
  },
  {
    id: "zai-cline-tooling",
    provider: "Z.ai",
    url: "https://docs.z.ai/devpack/tool/cline",
    titleHint: "GLM Cline integration",
    modelHints: ["GLM-5", "GLM-4.7"],
    signalType: "api",
    summaryHint:
      "Z.ai documents using GLM models inside local coding tools like Cline through the official coding endpoint.",
  },
  {
    id: "zai-droid-tooling",
    provider: "Z.ai",
    url: "https://docs.z.ai/devpack/tool/droid",
    titleHint: "GLM Droid integration",
    modelHints: ["GLM-5", "GLM-4.7"],
    signalType: "api",
    summaryHint:
      "Z.ai documents using GLM models inside local agent tooling through the official coding plan.",
  },
];

function extractTitle(html: string) {
  const raw =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ??
    null;
  return raw ? decodeHtmlEntities(raw) : null;
}

function extractDescription(html: string) {
  const raw =
    html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    null;
  return raw ? decodeHtmlEntities(raw) : null;
}

function extractPublishedAt(html: string) {
  const iso =
    html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ??
    null;
  if (!iso) return null;

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isGenericTitle(title: string | null, source: ProviderDeploymentSource) {
  if (!title) return true;

  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;

  if (normalized === "overview" || normalized === "guide") return true;
  if (normalized.includes("overview - z.ai developer document")) return true;
  if (normalized.includes("developer document") && normalized.includes("overview")) return true;
  if (normalized.startsWith("factory droid - overview")) return true;
  if (normalized.startsWith("cline - overview")) return true;
  if (normalized === source.provider.toLowerCase()) return true;

  return false;
}

function isGenericSummary(summary: string | null, source: ProviderDeploymentSource) {
  if (!summary) return true;

  const normalized = summary.trim().toLowerCase();
  if (!normalized) return true;

  if (normalized.includes("open platform provides")) return true;
  if (normalized.includes("methods for using the glm coding plan")) return true;
  if (normalized.includes("methods for using the glm coding plan in")) return true;
  if (normalized === source.provider.toLowerCase()) return true;

  return false;
}

function buildRelationText(source: ProviderDeploymentSource, title: string, summary: string) {
  return `${title} ${summary} ${source.modelHints.join(" ")}`.trim();
}

function buildModelRelations(
  source: ProviderDeploymentSource,
  title: string,
  summary: string,
  lookup: ModelLookupEntry[],
  aliasIndex: ReturnType<typeof buildModelAliasIndex>
) {
  const relation = resolveNewsRelations(
    title,
    buildRelationText(source, title, summary),
    { provider: source.provider },
    lookup
  );

  const hintedIds = source.modelHints.flatMap((hint) =>
    resolveAliasFamilyModelIds(aliasIndex, {
      slugCandidates: [hint],
      nameCandidates: [hint],
    })
  );

  if (hintedIds.length > 0) {
    return limitProviderScopedModelIds([...new Set(hintedIds)], 8);
  }

  return limitProviderScopedModelIds([...new Set(relation.modelIds)], 8);
}

const adapter: DataSourceAdapter = {
  id: "provider-deployment-signals",
  name: "Provider Deployment Signals",
  outputTypes: ["news"],
  defaultConfig: {
    maxPages: PROVIDER_DEPLOYMENT_SOURCES.length,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages =
      (typeof ctx.config.maxPages === "number" ? ctx.config.maxPages : null) ??
      PROVIDER_DEPLOYMENT_SOURCES.length;

    const models = await fetchAllActiveAliasModels(ctx.supabase);
    const lookup = await buildModelLookup(ctx.supabase);
    const aliasIndex = buildModelAliasIndex(models);
    const records: Record<string, unknown>[] = [];
    const errors: Array<{ message: string; context?: string }> = [];
    let recordsProcessed = 0;

    for (const source of PROVIDER_DEPLOYMENT_SOURCES.slice(0, maxPages)) {
      recordsProcessed++;

      const response = await fetchWithRetry(
        source.url,
        {
          headers: PROVIDER_PAGE_HEADERS,
          signal: ctx.signal,
        },
        { signal: ctx.signal, maxRetries: 2, baseDelayMs: 1200 }
      ).catch((error) => error);

      if (response instanceof Error) {
        errors.push({
          message: `Failed to fetch ${source.url}: ${response.message}`,
          context: source.id,
        });
        continue;
      }

      if (!response.ok) {
        errors.push({
          message: `${source.url} returned HTTP ${response.status}`,
          context: source.id,
        });
        continue;
      }

      const html = await response.text();
      const extractedTitle = extractTitle(html);
      const extractedSummary = extractDescription(html);
      const title = isGenericTitle(extractedTitle, source)
        ? source.titleHint
        : extractedTitle ?? source.titleHint;
      const summary = isGenericSummary(extractedSummary, source)
        ? source.summaryHint
        : extractedSummary ?? source.summaryHint;
      const publishedAt = extractPublishedAt(html) ?? new Date().toISOString();
      const relatedModelIds = buildModelRelations(source, title, summary, lookup, aliasIndex);

      records.push({
        source: "provider-deployment-signals",
        source_id: `provider-deployment-signals-${source.id}`,
        title,
        summary,
        url: source.url,
        published_at: publishedAt,
        category: source.signalType,
        related_provider: source.provider,
        related_model_ids: relatedModelIds,
        tags: [
          "deployability",
          "official",
          makeSlug(source.provider),
          source.signalType === "open_source" ? "self-host" : "tooling",
        ],
        metadata: {
          signal_type: source.signalType,
          signal_importance: source.signalType === "open_source" ? "high" : "medium",
          provider: source.provider,
          source_type: "official_provider_page",
          source_key: source.id,
          model_hints: source.modelHints,
          deployment_update: true,
        },
      });
    }

    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "model_news",
      records,
      "source,source_id",
      50
    );

    return {
      success: errors.length === 0 && upsertErrors.length === 0,
      recordsProcessed,
      recordsCreated: created,
      recordsUpdated: Math.max(0, records.length - created),
      errors: [...errors, ...upsertErrors],
      metadata: {
        sourceCount: PROVIDER_DEPLOYMENT_SOURCES.length,
        pagesFetched: records.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.all(
      PROVIDER_DEPLOYMENT_SOURCES.slice(0, 3).map(async (source) => {
        const startedAt = Date.now();
        try {
          const response = await fetchWithRetry(
            source.url,
            { headers: PROVIDER_PAGE_HEADERS },
            { maxRetries: 1, baseDelayMs: 500 }
          );

          return {
            ok: response.ok,
            latencyMs: Date.now() - startedAt,
          };
        } catch {
          return {
            ok: false,
            latencyMs: Date.now() - startedAt,
          };
        }
      })
    );

    const okCount = checks.filter((check) => check.ok).length;
    const latencyMs =
      checks.length > 0
        ? Math.round(
            checks.reduce((sum, check) => sum + check.latencyMs, 0) / checks.length
          )
        : 0;

    return {
      healthy: okCount > 0,
      latencyMs,
      message: `${okCount}/${checks.length} provider deployment pages reachable`,
    };
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  extractTitle,
  extractDescription,
  extractPublishedAt,
  isGenericTitle,
  isGenericSummary,
};

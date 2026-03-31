import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";
import {
  buildModelAliasIndex,
  resolveAliasFamilyModelIds,
} from "../model-alias-resolver";

const LIBRARY_URL = "https://ollama.com/library";
const USER_AGENT = "AI-Market-Cap-Bot/1.0";
const OLLAMA_CLOUD_PLATFORM = {
  slug: "ollama-cloud",
  name: "Ollama Cloud",
  type: "hosting" as const,
  base_url: "https://ollama.com/library",
  has_affiliate: false,
};

interface AliasModelRecord {
  id: string;
  slug: string;
  name: string;
  provider: string;
}

interface ParsedOllamaModelPage {
  slug: string;
  title: string;
  description: string | null;
  contextWindow: string | null;
  localCommands: string[];
  cloudCommands: string[];
}

interface ModelRecord {
  id: string;
  slug: string;
  name: string;
  provider: string;
}

function decodeLibrarySlug(rawSlug: string) {
  return decodeURIComponent(rawSlug).trim().replace(/^\/+|\/+$/g, "");
}

function humanizeLibrarySlug(slug: string) {
  return slug
    .replace(/%3A/gi, ":")
    .replace(/[-_/]+/g, " ")
    .replace(/\bglm\b/gi, "GLM")
    .replace(/\bm\d(?:\.\d)?\b/gi, (value) => value.toUpperCase())
    .replace(/\bqwen\b/gi, "Qwen")
    .replace(/\bkimi\b/gi, "Kimi")
    .replace(/\bgpt\b/gi, "GPT")
    .replace(/\bollama\b/gi, "Ollama")
    .replace(/\b([a-z])/g, (value) => value.toUpperCase());
}

function extractLibrarySlugs(html: string): string[] {
  const found = new Set<string>();
  const matches = html.matchAll(/href="\/library\/([^"#?]+)"/gi);

  for (const match of matches) {
    const slug = decodeLibrarySlug(match[1] ?? "");
    if (!slug || slug.includes("/")) continue;
    found.add(slug);
  }

  return [...found].sort();
}

function extractRunCommands(html: string) {
  return [...new Set([...html.matchAll(/ollama run ([a-z0-9._:-]+)/gi)].map((match) => match[1]))];
}

function isCloudCommand(command: string) {
  return /:.*cloud/i.test(command);
}

function extractTitle(html: string, slug: string) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return decodeLibrarySlug(titleMatch?.[1] ?? slug);
}

function extractDescription(html: string) {
  const descriptionMatch = html.match(/property="og:description" content="([^"]+)"/i);
  return descriptionMatch?.[1]
    ?.replace(/&#39;/g, "'")
    ?.replace(/&quot;/g, '"')
    ?.trim() ?? null;
}

function extractContextWindow(html: string) {
  const match = html.match(/([0-9]+[KMG]?) context window/i);
  return match?.[1] ?? null;
}

function parseOllamaModelPage(slug: string, html: string): ParsedOllamaModelPage {
  const commands = extractRunCommands(html);
  const localCommands = commands.filter((command) => !isCloudCommand(command));
  const cloudCommands = commands.filter((command) => isCloudCommand(command));

  return {
    slug,
    title: extractTitle(html, slug),
    description: extractDescription(html),
    contextWindow: extractContextWindow(html),
    localCommands,
    cloudCommands,
  };
}

function buildAliasCandidates(page: ParsedOllamaModelPage) {
  const localFamilies = page.localCommands.map((command) => command.split(":")[0]);
  const cloudFamilies = page.cloudCommands.map((command) =>
    command.replace(/:cloud$/i, "").split(":")[0]
  );

  return {
    slugCandidates: [
      page.slug,
      page.slug.replace(/:cloud$/i, ""),
      ...localFamilies,
      ...cloudFamilies,
    ],
    nameCandidates: [
      page.title,
      humanizeLibrarySlug(page.slug),
      ...localFamilies.map(humanizeLibrarySlug),
      ...cloudFamilies.map(humanizeLibrarySlug),
    ],
  };
}

async function fetchLibrarySlugs(signal?: AbortSignal) {
  const response = await fetchWithRetry(
    LIBRARY_URL,
    { headers: { "User-Agent": USER_AGENT }, signal },
    { signal, maxRetries: 1 }
  );
  if (!response.ok) return [];
  return extractLibrarySlugs(await response.text());
}

async function fetchOllamaModelPage(slug: string, signal?: AbortSignal) {
  const pageUrl = `${LIBRARY_URL}/${encodeURIComponent(slug).replace(/%3A/gi, ":")}`;
  const response = await fetchWithRetry(
    pageUrl,
    { headers: { "User-Agent": USER_AGENT }, signal },
    { signal, maxRetries: 1 }
  );

  if (!response.ok) {
    throw new Error(`Ollama library page returned HTTP ${response.status} for ${slug}`);
  }

  return parseOllamaModelPage(slug, await response.text());
}

function buildDeploymentRecords(input: {
  page: ParsedOllamaModelPage;
  modelIds: string[];
  platformIds: { ollama: string | null; ollamaCloud: string | null };
}) {
  const records: Record<string, unknown>[] = [];
  const pageUrl = `${LIBRARY_URL}/${input.page.slug}`;

  for (const modelId of input.modelIds) {
    if (input.page.localCommands.length > 0 && input.platformIds.ollama) {
      records.push({
        model_id: modelId,
        platform_id: input.platformIds.ollama,
        deploy_url: pageUrl,
        pricing_model: "free",
        price_per_unit: 0,
        unit_description: "",
        free_tier: "Local Ollama runtime",
        one_click: false,
        status: "available",
        last_price_check: new Date().toISOString(),
      });
    }

    if (input.page.cloudCommands.length > 0 && input.platformIds.ollamaCloud) {
      records.push({
        model_id: modelId,
        platform_id: input.platformIds.ollamaCloud,
        deploy_url: pageUrl,
        pricing_model: null,
        price_per_unit: null,
        unit_description: "Cloud runtime",
        free_tier: null,
        one_click: true,
        status: "available",
        last_price_check: new Date().toISOString(),
      });
    }
  }

  return records;
}

function buildAvailabilitySummary(page: ParsedOllamaModelPage, model: ModelRecord) {
  const supportParts: string[] = [];

  if (page.localCommands.length > 0) {
    supportParts.push("local Ollama runtime");
  }

  if (page.cloudCommands.length > 0) {
    supportParts.push("Ollama Cloud");
  }

  if (supportParts.length === 0) {
    supportParts.push("Ollama");
  }

  const contextPart = page.contextWindow ? ` ${page.contextWindow} context window listed.` : "";
  const descriptionPart = page.description ? ` ${page.description}` : "";
  return `${model.name} is now available through ${supportParts.join(" and ")}.${contextPart}${descriptionPart}`.trim();
}

function buildNewsRecords(input: {
  page: ParsedOllamaModelPage;
  models: ModelRecord[];
}) {
  const pageUrl = `${LIBRARY_URL}/${input.page.slug}`;

  return input.models.map((model) => {
    const hasLocalRuntime = input.page.localCommands.length > 0;
    const hasCloudRuntime = input.page.cloudCommands.length > 0;
    const signalType = hasLocalRuntime ? "open_source" : "api";
    const title = hasLocalRuntime
      ? `${model.name} is now available on Ollama`
      : `${model.name} is now available on Ollama Cloud`;

    return {
      source: "ollama-library",
      source_id: `ollama-library-${model.slug}`,
      title,
      summary: buildAvailabilitySummary(input.page, model),
      url: pageUrl,
      published_at: new Date().toISOString(),
      category: signalType,
      related_provider: model.provider,
      related_model_ids: [model.id],
      tags: [
        "deployability",
        "ollama",
        makeSlug(model.provider),
        hasLocalRuntime ? "local-runtime" : "cloud-runtime",
        hasCloudRuntime ? "managed-cloud" : "self-serve",
      ],
      metadata: {
        signal_type: signalType,
        signal_importance: hasLocalRuntime ? "high" : "medium",
        source_type: "deployment_catalog",
        deployment_provider: "ollama",
        local_runtime: hasLocalRuntime,
        cloud_runtime: hasCloudRuntime,
        context_window: input.page.contextWindow,
        local_commands: input.page.localCommands,
        cloud_commands: input.page.cloudCommands,
      },
    };
  });
}

const adapter: DataSourceAdapter = {
  id: "ollama-library",
  name: "Ollama Library",
  outputTypes: ["pricing", "news"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const { supabase } = ctx;
    const errors: { message: string; context?: string }[] = [];

    const [{ data: models }, { data: existingPlatforms }] = await Promise.all([
      supabase
        .from("models")
        .select("id, slug, name, provider")
        .eq("status", "active"),
      supabase.from("deployment_platforms").select("id, slug"),
    ]);

    if (!models || models.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "No active models found", context: "models query" }],
      };
    }

    await supabase
      .from("deployment_platforms")
      .upsert([OLLAMA_CLOUD_PLATFORM], { onConflict: "slug" });

    const { data: platformsAfterUpsert } = await supabase
      .from("deployment_platforms")
      .select("id, slug");

    const platformRows = platformsAfterUpsert ?? existingPlatforms ?? [];
    const ollamaPlatformId = platformRows.find((platform) => platform.slug === "ollama")?.id ?? null;
    const ollamaCloudPlatformId =
      platformRows.find((platform) => platform.slug === "ollama-cloud")?.id ?? null;

    const typedModels = models as ModelRecord[];
    const aliasIndex = buildModelAliasIndex(typedModels as AliasModelRecord[]);
    const librarySlugs = await fetchLibrarySlugs(ctx.signal);
    const relevantSlugs = librarySlugs.filter((slug) => {
      const matchedIds = resolveAliasFamilyModelIds(aliasIndex, {
        slugCandidates: [slug, slug.replace(/:cloud$/i, "")],
        nameCandidates: [humanizeLibrarySlug(slug)],
      });
      return matchedIds.length > 0;
    });

    const deploymentRecords: Record<string, unknown>[] = [];
    const newsRecords: Record<string, unknown>[] = [];

    for (const slug of relevantSlugs) {
      try {
        const page = await fetchOllamaModelPage(slug, ctx.signal);
        const matchedIds = resolveAliasFamilyModelIds(aliasIndex, buildAliasCandidates(page));
        if (matchedIds.length === 0) continue;
        const matchedModels = typedModels.filter((model) => matchedIds.includes(model.id));

        deploymentRecords.push(
          ...buildDeploymentRecords({
            page,
            modelIds: matchedIds,
            platformIds: {
              ollama: ollamaPlatformId,
              ollamaCloud: ollamaCloudPlatformId,
            },
          })
        );
        newsRecords.push(
          ...buildNewsRecords({
            page,
            models: matchedModels,
          })
        );
      } catch (error) {
        errors.push({
          message: error instanceof Error ? error.message : String(error),
          context: `ollama page ${slug}`,
        });
      }
    }

    const { created, errors: upsertErrors } = await upsertBatch(
      supabase,
      "model_deployments",
      deploymentRecords,
      "model_id,platform_id"
    );
    const { created: newsCreated, errors: newsUpsertErrors } = await upsertBatch(
      supabase,
      "model_news",
      newsRecords,
      "source,source_id"
    );

    return {
      success:
        errors.length === 0 &&
        upsertErrors.length === 0 &&
        newsUpsertErrors.length === 0,
      recordsProcessed: relevantSlugs.length,
      recordsCreated: created + newsCreated,
      recordsUpdated: Math.max(0, deploymentRecords.length + newsRecords.length - (created + newsCreated)),
      errors: [...errors, ...upsertErrors, ...newsUpsertErrors],
      metadata: {
        librarySlugs: librarySlugs.length,
        relevantSlugs: relevantSlugs.length,
        deploymentRecords: deploymentRecords.length,
        newsRecords: newsRecords.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetchWithRetry(
        LIBRARY_URL,
        { headers: { "User-Agent": USER_AGENT } },
        { maxRetries: 1 }
      );
      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        message: response.ok
          ? "Ollama library reachable"
          : `Ollama library returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Ollama library unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  extractLibrarySlugs,
  parseOllamaModelPage,
  buildAliasCandidates,
  buildNewsRecords,
};

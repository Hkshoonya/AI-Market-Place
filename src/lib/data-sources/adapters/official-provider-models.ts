import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";
import {
  buildRecord,
  type KnownModelMeta,
  type ProviderDefaults,
} from "../shared/build-record";
import { COHERE_KNOWN_MODELS } from "../shared/known-models/cohere";
import { META_KNOWN_MODELS } from "../shared/known-models/meta";
import { MISTRAL_KNOWN_MODELS } from "../shared/known-models/mistral";

const CATALOG_URLS = {
  cohere: "https://docs.cohere.com/docs/models.md",
  meta: "https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/",
  mistral: "https://docs.mistral.ai/models/model-selection-guide",
} as const;

const REQUEST_HEADERS = {
  "User-Agent": "AI-Market-Cap-Bot/1.0",
};

const MISTRAL_DEFAULTS: ProviderDefaults = {
  provider: "Mistral AI",
  slugPrefix: "mistralai",
};

const COHERE_DEFAULTS: ProviderDefaults = {
  provider: "Cohere",
  slugPrefix: "cohere",
};

type CohereSection = "Command" | "Embed" | "Rerank" | "Audio" | "Aya";

interface CatalogFetchResult {
  ok: boolean;
  status: number | null;
  text: string;
}

interface DiscoveredModel {
  id: string;
  meta: KnownModelMeta;
}

function humanizeModelId(modelId: string): string {
  return modelId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d/.test(part) || /^v\d/i.test(part)) return part.toUpperCase();
      if (part === "ocr" || part === "tts" || part === "aya") {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseContextWindow(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = stripMarkdown(value).replace(/,/g, "").trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([km])?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const multiplier =
    match[2]?.toLowerCase() === "m"
      ? 1024 * 1024
      : match[2]?.toLowerCase() === "k"
        ? 1024
        : 1;
  return Math.round(amount * multiplier);
}

function parseModalities(value: string | undefined): string[] {
  const normalized = stripMarkdown(value ?? "").toLowerCase();
  const modalities = new Set<string>();

  if (normalized.includes("text")) modalities.add("text");
  if (normalized.includes("image")) modalities.add("image");
  if (normalized.includes("audio")) modalities.add("audio");
  if (normalized.includes("video")) modalities.add("video");
  if (normalized.includes("pdf") || normalized.includes("document")) {
    modalities.add("file");
  }

  return modalities.size > 0 ? [...modalities] : ["text"];
}

function parseCohereStatus(value: string | undefined): string {
  const normalized = stripMarkdown(value ?? "").toLowerCase();
  if (normalized.includes("retired")) return "archived";
  if (normalized.includes("deprecated")) return "deprecated";
  if (normalized.includes("preview")) return "preview";
  return "active";
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function getCohereCategory(
  section: CohereSection,
  modalities: string[]
): string {
  if (section === "Embed" || section === "Rerank") return "embeddings";
  if (section === "Audio") return "speech_audio";
  if (section === "Command" && modalities.includes("image")) {
    return "multimodal";
  }
  if (section === "Aya" && modalities.includes("image")) {
    return "multimodal";
  }
  return "llm";
}

function getCohereCapabilities(
  section: CohereSection,
  modalities: string[]
): Record<string, boolean> {
  const capabilities: Record<string, boolean> = {};

  if (modalities.includes("image")) capabilities.vision = true;
  if (section === "Command") {
    capabilities.reasoning = true;
    capabilities.tool_use = true;
    capabilities.streaming = true;
  } else if (section === "Embed") {
    capabilities.embeddings = true;
  } else if (section === "Rerank") {
    capabilities.reranking = true;
  } else if (section === "Audio") {
    capabilities.transcription = true;
  } else if (section === "Aya") {
    capabilities.streaming = true;
  }

  return capabilities;
}

function extractFirstMarkdownTable(sectionText: string): {
  headers: string[];
  rows: string[][];
} | null {
  const lines = sectionText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^\|\s*Model Name\s*\|/i.test(line)
  );
  if (headerIndex < 0 || headerIndex + 2 >= lines.length) return null;

  const headers = splitMarkdownRow(lines[headerIndex]);
  const rows: string[][] = [];
  for (let index = headerIndex + 2; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) break;
    rows.push(splitMarkdownRow(line));
  }

  return { headers, rows };
}

function parseCohereCatalog(markdown: string): DiscoveredModel[] {
  const sections: CohereSection[] = [
    "Command",
    "Embed",
    "Rerank",
    "Audio",
    "Aya",
  ];
  const discovered = new Map<string, DiscoveredModel>();

  for (const section of sections) {
    const startMarker = `## ${section}`;
    const start = markdown.indexOf(startMarker);
    if (start < 0) continue;

    const nextSection = markdown.indexOf("\n## ", start + startMarker.length);
    const sectionText = markdown.slice(
      start,
      nextSection >= 0 ? nextSection : markdown.length
    );
    const table = extractFirstMarkdownTable(sectionText);
    if (!table) continue;

    const normalizedHeaders = table.headers.map((header) =>
      stripMarkdown(header).toLowerCase()
    );
    const statusIndex = normalizedHeaders.indexOf("status");
    const descriptionIndex = normalizedHeaders.indexOf("description");
    const modalityIndex = normalizedHeaders.findIndex((header) =>
      header.startsWith("modalit")
    );
    const contextIndex = normalizedHeaders.indexOf("context length");

    for (const row of table.rows) {
      const id = row[0]?.match(/`([^`]+)`/)?.[1]?.trim();
      if (!id || !/^[a-z0-9][a-z0-9.+-]*$/i.test(id)) continue;

      const modalities = parseModalities(
        modalityIndex >= 0 ? row[modalityIndex] : undefined
      );
      const category = getCohereCategory(section, modalities);
      const description =
        descriptionIndex >= 0
          ? stripMarkdown(row[descriptionIndex])
          : `Cohere ${section.toLowerCase()} model listed in the official catalog.`;

      discovered.set(id, {
        id,
        meta: {
          name: humanizeModelId(id),
          description,
          category,
          context_window:
            contextIndex >= 0
              ? parseContextWindow(row[contextIndex])
              : null,
          status:
            statusIndex >= 0
              ? parseCohereStatus(row[statusIndex])
              : "active",
          modalities,
          capabilities: getCohereCapabilities(section, modalities),
          is_api_available: true,
          is_open_weights: false,
          license: "commercial",
          license_name: null,
          website_url: "https://docs.cohere.com/docs/models",
        },
      });
    }
  }

  return [...discovered.values()];
}

function extractMistralCatalogIds(html: string): string[] {
  const ids = new Set<string>();
  const pattern =
    />\s*IDS\s*<\/p>[\s\S]{0,1000}?<code[^>]*>([^<]+)<\/code>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const id = match[1].trim();
    if (
      /^(?:mistral|ministral|voxtral|codestral|labs-leanstral)[a-z0-9.-]*(?:-[a-z0-9.]+)+$/i.test(
        id
      )
    ) {
      ids.add(id);
    }
  }

  return [...ids].sort();
}

function findKnownMeta(
  catalog: Record<string, KnownModelMeta>,
  modelId: string
): KnownModelMeta | undefined {
  const direct = catalog[modelId];
  if (direct) return direct;

  const normalizedId = makeSlug(modelId);
  return Object.entries(catalog).find(
    ([knownId]) => makeSlug(knownId) === normalizedId
  )?.[1];
}

function buildProviderRecord(
  modelId: string,
  discoveredMeta: KnownModelMeta | undefined,
  catalog: Record<string, KnownModelMeta>,
  defaults: ProviderDefaults
): Record<string, unknown> {
  const knownMeta = findKnownMeta(catalog, modelId);
  const mergedMeta = knownMeta
    ? { ...discoveredMeta, ...knownMeta }
    : discoveredMeta;

  return buildRecord(modelId, mergedMeta, {}, defaults);
}

function buildDiscoveredProviderRecord(
  modelId: string,
  discoveredMeta: KnownModelMeta,
  catalog: Record<string, KnownModelMeta>,
  defaults: ProviderDefaults
): Record<string, unknown> {
  const knownMeta = findKnownMeta(catalog, modelId);
  if (knownMeta) {
    return buildProviderRecord(
      modelId,
      discoveredMeta,
      catalog,
      defaults
    );
  }

  const record = buildRecord(modelId, discoveredMeta, {}, defaults);

  // The catalog tables do not publish weight licenses or release dates for
  // every row. Omitting unknown columns preserves stronger OpenRouter/HF data
  // on conflict while database defaults remain conservative for new rows.
  delete record.architecture;
  delete record.parameter_count;
  delete record.release_date;
  delete record.is_open_weights;
  delete record.license;
  delete record.license_name;
  delete record.hf_model_id;
  if (record.context_window == null) delete record.context_window;

  return record;
}

function buildStaticRecords(): Record<string, unknown>[] {
  return [
    ...Object.entries(META_KNOWN_MODELS).map(([modelId, meta]) =>
      buildRecord(modelId, meta, {}, {
        provider: "Meta",
        slugPrefix: modelId.startsWith("muse-") ? "meta" : "meta-llama",
      })
    ),
    ...Object.entries(MISTRAL_KNOWN_MODELS).map(([modelId, meta]) =>
      buildRecord(modelId, meta, {}, MISTRAL_DEFAULTS)
    ),
    ...Object.entries(COHERE_KNOWN_MODELS).map(([modelId, meta]) =>
      buildRecord(modelId, meta, {}, COHERE_DEFAULTS)
    ),
  ];
}

async function fetchCatalog(
  url: string,
  signal?: AbortSignal
): Promise<CatalogFetchResult> {
  try {
    const response = await fetchWithRetry(
      url,
      { headers: REQUEST_HEADERS, signal },
      { maxRetries: 1, signal }
    );
    return {
      ok: response.ok,
      status: response.status,
      text: response.ok ? await response.text() : "",
    };
  } catch {
    return { ok: false, status: null, text: "" };
  }
}

function buildCatalogRecords(
  mistralHtml: string,
  cohereMarkdown: string
): Record<string, unknown>[] {
  const recordsBySlug = new Map<string, Record<string, unknown>>();
  for (const record of buildStaticRecords()) {
    recordsBySlug.set(String(record.slug), record);
  }

  for (const modelId of extractMistralCatalogIds(mistralHtml)) {
    const discoveredMeta: KnownModelMeta = {
      name: humanizeModelId(modelId),
      description:
        "Current Mistral AI model discovered in the official model selection guide.",
      status: "active",
      is_api_available: true,
      is_open_weights: false,
      license: "commercial",
      license_name: null,
      website_url: CATALOG_URLS.mistral,
    };
    const record = buildDiscoveredProviderRecord(
      modelId,
      discoveredMeta,
      MISTRAL_KNOWN_MODELS,
      MISTRAL_DEFAULTS
    );
    recordsBySlug.set(String(record.slug), record);
  }

  for (const { id, meta } of parseCohereCatalog(cohereMarkdown)) {
    const record = buildDiscoveredProviderRecord(
      id,
      meta,
      COHERE_KNOWN_MODELS,
      COHERE_DEFAULTS
    );
    recordsBySlug.set(String(record.slug), record);
  }

  return [...recordsBySlug.values()];
}

const adapter: DataSourceAdapter = {
  id: "official-provider-models",
  name: "Official Provider Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const [metaResult, mistralResult, cohereResult] = await Promise.all([
      fetchCatalog(CATALOG_URLS.meta, ctx.signal),
      fetchCatalog(CATALOG_URLS.mistral, ctx.signal),
      fetchCatalog(CATALOG_URLS.cohere, ctx.signal),
    ]);
    const records = buildCatalogRecords(
      mistralResult.text,
      cohereResult.text
    );
    const { created, errors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );

    return {
      success: errors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: created,
      recordsUpdated: records.length - created,
      errors,
      metadata: {
        officialCatalogs: {
          meta: { reachable: metaResult.ok, status: metaResult.status },
          mistral: {
            reachable: mistralResult.ok,
            status: mistralResult.status,
            discoveredIds: extractMistralCatalogIds(mistralResult.text).length,
          },
          cohere: {
            reachable: cohereResult.ok,
            status: cohereResult.status,
            discoveredIds: parseCohereCatalog(cohereResult.text).length,
          },
        },
        staticRecords: buildStaticRecords().length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const results = await Promise.all(
        Object.values(CATALOG_URLS).map((url) =>
          fetchCatalog(url, controller.signal)
        )
      );
      const healthyCount = results.filter((result) => result.ok).length;

      return {
        healthy: healthyCount === results.length,
        latencyMs: Date.now() - start,
        message: `${healthyCount}/${results.length} official provider catalogs reachable`,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  buildCatalogRecords,
  buildStaticRecords,
  extractMistralCatalogIds,
  parseCohereCatalog,
  parseContextWindow,
};

import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncError,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch } from "../utils";
import { parseCsvRows } from "./remote-benchmark";
import {
  getCanonicalProviderName,
  normalizeProviderKey,
} from "@/lib/constants/providers";
import type {
  ModelMetadataEvidence,
  TypedSupabaseClient,
} from "@/types/database";

const DATASET_URL = "https://epoch.ai/data/all_ai_models.csv";
const DOCUMENTATION_URL = "https://epoch.ai/data/ai-models-documentation";
const DEFAULT_MAX_DATASET_BYTES = 12 * 1024 * 1024;
const MODEL_PAGE_SIZE = 1_000;
const EVIDENCE_QUERY_BATCH_SIZE = 200;

interface EpochModelRecord {
  model: string;
  domain: string;
  task: string;
  organization: string;
  publicationDate: string;
  reference: string;
  links: string;
  parameters: string;
  parameterNotes: string;
  trainingComputeFlop: string;
  trainingComputeNotes: string;
  trainingDatasetSize: string;
  datasetSizeNotes: string;
  confidence: string;
  abstract: string;
  accessibility: string;
  baseModel: string;
  lastModified: string;
  huggingFaceDeveloperId: string;
  openModelWeights: string;
}

interface MatchableModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  description: string | null;
  parameter_count: number | null;
  release_date: string | null;
  website_url: string | null;
  github_url: string | null;
  hf_model_id: string | null;
  modalities: string[];
}

interface MatchedEpochModel {
  model: MatchableModel;
  record: EpochModelRecord;
}

interface MetadataUpdateInsert {
  model_id: string;
  update_type: string;
  title: string;
  description: string;
  source_url: string;
  published_at: string;
}

type CoreGapField =
  | "parameter_count"
  | "release_date"
  | "description"
  | "website_url"
  | "github_url"
  | "hf_model_id";

const ORGANIZATION_PROVIDER_RULES: Array<{
  pattern: RegExp;
  provider: string;
}> = [
  { pattern: /\b(?:alibaba|qwen)\b/i, provider: "Qwen" },
  { pattern: /\b(?:google|deepmind)\b/i, provider: "Google" },
  { pattern: /\b(?:meta ai|facebook ai|fair)\b/i, provider: "Meta" },
  { pattern: /(?:\bz\.?\s*ai\b|\bzhipu\b)/i, provider: "Z.ai" },
  { pattern: /\bmoonshot\b/i, provider: "Moonshot AI" },
  { pattern: /\bmicrosoft\b/i, provider: "Microsoft" },
  { pattern: /\bmistral\b/i, provider: "Mistral AI" },
  { pattern: /\banthropic\b/i, provider: "Anthropic" },
  { pattern: /\bopenai\b/i, provider: "OpenAI" },
  { pattern: /\bxai\b/i, provider: "xAI" },
  { pattern: /\bnvidia\b/i, provider: "NVIDIA" },
  { pattern: /\bdeepseek\b/i, provider: "DeepSeek" },
  { pattern: /\bminimax\b/i, provider: "MiniMax" },
  { pattern: /\bcohere\b/i, provider: "Cohere" },
  { pattern: /\b(?:amazon|aws)\b/i, provider: "Amazon" },
  { pattern: /\bapple\b/i, provider: "Apple" },
  { pattern: /\bbaidu\b/i, provider: "Baidu" },
  { pattern: /\bai21\b/i, provider: "AI21 Labs" },
  { pattern: /\bstability ai\b/i, provider: "Stability AI" },
  { pattern: /\bblack forest labs\b/i, provider: "Black Forest Labs" },
  { pattern: /\bdatabricks\b/i, provider: "Databricks" },
];

function cleanText(value: string, maxLength = 2_000): string | null {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function normalizeEpochModelName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEpochProviderCandidates(organization: string): Set<string> {
  const candidates = new Set<string>();
  const addCandidate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    candidates.add(getCanonicalProviderName(trimmed));
  };

  addCandidate(organization);
  addCandidate(organization.replace(/\([^)]*\)/g, " "));
  for (const match of organization.matchAll(/\(([^)]*)\)/g)) {
    addCandidate(match[1] ?? "");
  }
  for (const segment of organization.split(/[,;|/]/)) {
    addCandidate(segment);
  }
  for (const rule of ORGANIZATION_PROVIDER_RULES) {
    if (rule.pattern.test(organization)) candidates.add(rule.provider);
  }

  return candidates;
}

function providerMatchesEpochOrganization(
  provider: string,
  organization: string
): boolean {
  const providerKeys = new Set([
    normalizeProviderKey(provider),
    normalizeProviderKey(getCanonicalProviderName(provider)),
  ]);

  return [...getEpochProviderCandidates(organization)].some((candidate) =>
    providerKeys.has(normalizeProviderKey(candidate))
  );
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const datePrefix = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePrefix) return null;
  const timestamp = Date.parse(`${datePrefix}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? datePrefix : null;
}

function parseTimestamp(value: string): string | null {
  const timestamp = Date.parse(value.trim());
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function extractHttpsUrls(value: string): string[] {
  const matches = value.match(/https:\/\/[^\s"<>]+/gi) ?? [];
  const urls = new Set<string>();

  for (const match of matches) {
    const candidate = match.replace(/[),.;]+$/g, "");
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:") urls.add(parsed.toString());
    } catch {
      // Ignore malformed source links instead of exposing them in the UI.
    }
  }

  return [...urls];
}

function extractHuggingFaceModelId(urls: string[]): string | null {
  for (const value of urls) {
    const url = new URL(value);
    if (url.hostname !== "huggingface.co") continue;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0] === "datasets" || parts[0] === "spaces") {
      continue;
    }
    return `${decodeURIComponent(parts[0])}/${decodeURIComponent(parts[1])}`;
  }
  return null;
}

function extractGitHubUrl(urls: string[]): string | null {
  return urls.find((value) => new URL(value).hostname === "github.com") ?? null;
}

function parseOpenWeights(record: EpochModelRecord): boolean | null {
  const explicit = record.openModelWeights.trim().toLowerCase();
  if (explicit === "yes" || explicit === "true") return true;
  if (explicit === "no" || explicit === "false") return false;

  const accessibility = record.accessibility.toLowerCase();
  if (accessibility.includes("open weights")) return true;
  if (accessibility.includes("api access") || accessibility.includes("unreleased")) {
    return false;
  }
  return null;
}

function parseEpochCsv(text: string): EpochModelRecord[] {
  const rows = parseCsvRows(text).filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );
  if (rows.length === 0) return [];

  const header = new Map(
    rows[0].map((name, index) => [name.replace(/^\uFEFF/, "").trim(), index])
  );
  const read = (row: string[], column: string) => {
    const index = header.get(column);
    return index === undefined ? "" : row[index] ?? "";
  };

  if (!header.has("Model") || !header.has("Organization")) {
    throw new Error("Epoch AI CSV is missing required model columns");
  }

  return rows.slice(1).flatMap((row) => {
    const model = read(row, "Model").trim();
    if (!model) return [];

    return [{
      model,
      domain: read(row, "Domain"),
      task: read(row, "Task"),
      organization: read(row, "Organization"),
      publicationDate: read(row, "Publication date"),
      reference: read(row, "Reference"),
      links: read(row, "Link"),
      parameters: read(row, "Parameters"),
      parameterNotes: read(row, "Parameters notes"),
      trainingComputeFlop: read(row, "Training compute (FLOP)"),
      trainingComputeNotes: read(row, "Training compute notes"),
      trainingDatasetSize: read(row, "Training dataset size (total)"),
      datasetSizeNotes: read(row, "Dataset size notes"),
      confidence: read(row, "Confidence"),
      abstract: read(row, "Abstract"),
      accessibility: read(row, "Model accessibility"),
      baseModel: read(row, "Base model"),
      lastModified: read(row, "Last modified"),
      huggingFaceDeveloperId: read(row, "Hugging Face developer id"),
      openModelWeights: read(row, "Open model weights?"),
    }];
  });
}

function epochRecordCompleteness(record: EpochModelRecord): number {
  const confidenceScore: Record<string, number> = {
    confident: 30,
    likely: 20,
    speculative: 10,
    unknown: 0,
  };
  const populatedFields = [
    record.parameters,
    record.trainingComputeFlop,
    record.trainingDatasetSize,
    record.abstract,
    record.links,
    record.publicationDate,
  ].filter((value) => value.trim()).length;

  return (
    (confidenceScore[record.confidence.trim().toLowerCase()] ?? 0) +
    populatedFields
  );
}

function preferEpochRecord(
  current: EpochModelRecord,
  candidate: EpochModelRecord
): EpochModelRecord {
  const currentScore = epochRecordCompleteness(current);
  const candidateScore = epochRecordCompleteness(candidate);
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }

  return Date.parse(candidate.lastModified) > Date.parse(current.lastModified)
    ? candidate
    : current;
}

function matchEpochRecords(
  records: EpochModelRecord[],
  models: MatchableModel[]
): MatchedEpochModel[] {
  const modelsByName = new Map<string, MatchableModel[]>();
  for (const model of models) {
    const key = normalizeEpochModelName(model.name);
    if (!key) continue;
    modelsByName.set(key, [...(modelsByName.get(key) ?? []), model]);
  }

  const matchesByModelId = new Map<string, MatchedEpochModel>();
  for (const record of records) {
    const candidates = modelsByName.get(normalizeEpochModelName(record.model)) ?? [];
    for (const model of candidates) {
      if (!providerMatchesEpochOrganization(model.provider, record.organization)) {
        continue;
      }

      const existing = matchesByModelId.get(model.id);
      matchesByModelId.set(model.id, {
        model,
        record: existing
          ? preferEpochRecord(existing.record, record)
          : record,
      });
    }
  }

  return [...matchesByModelId.values()];
}

function buildEvidenceRecord(
  model: MatchableModel,
  record: EpochModelRecord,
  observedAt: string
): Record<string, unknown> {
  const urls = extractHttpsUrls(record.links);
  const sourceRecordId = `${normalizeEpochModelName(record.model)}:${normalizeProviderKey(record.organization)}`;

  return {
    model_id: model.id,
    source: "epoch-ai",
    source_record_id: sourceRecordId.slice(0, 500),
    source_name: record.model.slice(0, 500),
    source_url: urls[0] ?? null,
    publication_date: parseDate(record.publicationDate),
    parameter_count: parsePositiveNumber(record.parameters),
    training_compute_flop: parsePositiveNumber(record.trainingComputeFlop),
    training_dataset_size: parsePositiveNumber(record.trainingDatasetSize),
    base_model: cleanText(record.baseModel, 500),
    accessibility: cleanText(record.accessibility, 500),
    is_open_weights: parseOpenWeights(record),
    confidence: cleanText(record.confidence, 80),
    abstract: cleanText(record.abstract),
    source_last_modified_at: parseTimestamp(record.lastModified),
    metadata: {
      organization: cleanText(record.organization, 500),
      domain: cleanText(record.domain, 500),
      task: cleanText(record.task, 800),
      reference: cleanText(record.reference, 500),
      parameter_notes: cleanText(record.parameterNotes, 600),
      training_compute_notes: cleanText(record.trainingComputeNotes, 600),
      dataset_size_notes: cleanText(record.datasetSizeNotes, 600),
      huggingface_developer_id: cleanText(record.huggingFaceDeveloperId, 200),
    },
    observed_at: observedAt,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const EVIDENCE_COMPARE_FIELDS = [
  "source_record_id",
  "source_name",
  "source_url",
  "publication_date",
  "parameter_count",
  "training_compute_flop",
  "training_dataset_size",
  "base_model",
  "accessibility",
  "is_open_weights",
  "confidence",
  "abstract",
  "source_last_modified_at",
  "metadata",
] as const;

function evidenceChanged(
  existing: ModelMetadataEvidence,
  candidate: Record<string, unknown>
): boolean {
  return EVIDENCE_COMPARE_FIELDS.some((field) => {
    const existingValue = existing[field];
    const candidateValue = candidate[field] ?? null;
    if (
      field === "parameter_count" ||
      field === "training_compute_flop" ||
      field === "training_dataset_size"
    ) {
      return Number(existingValue ?? 0) !== Number(candidateValue ?? 0);
    }
    if (field === "source_last_modified_at") {
      const existingTime = existingValue ? Date.parse(String(existingValue)) : 0;
      const candidateTime = candidateValue ? Date.parse(String(candidateValue)) : 0;
      return existingTime !== candidateTime;
    }
    return stableJson(existingValue ?? null) !== stableJson(candidateValue);
  });
}

function buildCoreGapPatch(
  model: MatchableModel,
  record: EpochModelRecord,
  refreshedAt: string
): { patch: Record<string, unknown>; fields: CoreGapField[] } {
  const patch: Record<string, unknown> = {};
  const fields: CoreGapField[] = [];
  const urls = extractHttpsUrls(record.links);
  const parameterCount = parsePositiveNumber(record.parameters);
  const releaseDate = parseDate(record.publicationDate);
  const description = cleanText(record.abstract, 1_000);
  const githubUrl = extractGitHubUrl(urls);
  const hfModelId = extractHuggingFaceModelId(urls);

  const assign = (field: CoreGapField, value: unknown) => {
    patch[field] = value;
    fields.push(field);
  };

  if (model.parameter_count === null && parameterCount !== null) {
    assign("parameter_count", parameterCount);
  }
  if (model.release_date === null && releaseDate) assign("release_date", releaseDate);
  if (model.description === null && description) assign("description", description);
  if (model.website_url === null && urls[0]) assign("website_url", urls[0]);
  if (model.github_url === null && githubUrl) assign("github_url", githubUrl);
  if (model.hf_model_id === null && hfModelId) assign("hf_model_id", hfModelId);

  if (fields.length > 0) patch.data_refreshed_at = refreshedAt;
  return { patch, fields };
}

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Epoch AI dataset exceeds ${maxBytes} bytes`);
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(`Epoch AI dataset exceeds ${maxBytes} bytes`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Epoch AI dataset exceeds ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

async function fetchAllMatchableModels(
  supabase: TypedSupabaseClient
): Promise<MatchableModel[]> {
  const models: MatchableModel[] = [];

  for (let from = 0; ; from += MODEL_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("models")
      .select(
        "id, slug, name, provider, description, parameter_count, release_date, website_url, github_url, hf_model_id, modalities"
      )
      .range(from, from + MODEL_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load model catalog: ${error.message}`);
    const page = (data ?? []) as MatchableModel[];
    models.push(...page);
    if (page.length < MODEL_PAGE_SIZE) break;
  }

  return models;
}

async function fetchExistingEvidence(
  supabase: TypedSupabaseClient,
  modelIds: string[]
): Promise<ModelMetadataEvidence[]> {
  const evidence: ModelMetadataEvidence[] = [];

  for (let index = 0; index < modelIds.length; index += EVIDENCE_QUERY_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("model_metadata_evidence")
      .select("*")
      .eq("source", "epoch-ai")
      .in("model_id", modelIds.slice(index, index + EVIDENCE_QUERY_BATCH_SIZE));

    if (error) throw new Error(`Failed to load Epoch evidence: ${error.message}`);
    evidence.push(...((data ?? []) as ModelMetadataEvidence[]));
  }

  return evidence;
}

async function insertModelUpdates(
  ctx: SyncContext,
  updates: MetadataUpdateInsert[]
): Promise<SyncError[]> {
  const errors: SyncError[] = [];
  for (let index = 0; index < updates.length; index += 100) {
    const { error } = await ctx.supabase
      .from("model_updates")
      .insert(updates.slice(index, index + 100));
    if (error) {
      errors.push({
        message: `Failed to record metadata changelog: ${error.message}`,
        context: `batch=${Math.floor(index / 100) + 1}`,
      });
    }
  }
  return errors;
}

const adapter: DataSourceAdapter = {
  id: "epoch-ai-models",
  name: "Epoch AI Models",
  outputTypes: ["models"],
  defaultConfig: {
    maxDatasetBytes: DEFAULT_MAX_DATASET_BYTES,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxDatasetBytes = Math.min(
      20 * 1024 * 1024,
      Math.max(
        1 * 1024 * 1024,
        typeof ctx.config.maxDatasetBytes === "number"
          ? ctx.config.maxDatasetBytes
          : DEFAULT_MAX_DATASET_BYTES
      )
    );
    const errors: SyncError[] = [];
    const observedAt = new Date().toISOString();

    const response = await fetchWithRetry(
      DATASET_URL,
      {
        headers: {
          Accept: "text/csv",
          "User-Agent": "AI-Market-Cap-Bot/1.0",
        },
        signal: ctx.signal,
      },
      { signal: ctx.signal, maxRetries: 2, baseDelayMs: 1_000 }
    );
    if (!response.ok) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `Epoch AI returned HTTP ${response.status}` }],
      };
    }

    const csv = await readResponseTextWithLimit(response, maxDatasetBytes);
    const records = parseEpochCsv(csv);
    const models = await fetchAllMatchableModels(ctx.supabase);
    const matches = matchEpochRecords(records, models);
    if (records.length === 0 || matches.length === 0) {
      return {
        success: false,
        recordsProcessed: records.length,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "Epoch AI dataset produced no safe catalog matches" }],
      };
    }

    const existingEvidence = await fetchExistingEvidence(
      ctx.supabase,
      matches.map((match) => match.model.id)
    );
    const existingByModelId = new Map(
      existingEvidence.map((evidence) => [evidence.model_id, evidence])
    );
    const evidenceCandidates = matches.map(({ model, record }) =>
      buildEvidenceRecord(model, record, observedAt)
    );
    const changedEvidence = evidenceCandidates.filter((candidate) => {
      const existing = existingByModelId.get(String(candidate.model_id));
      return !existing || evidenceChanged(existing, candidate);
    });

    if (changedEvidence.length > 0) {
      const evidenceUpsert = await upsertBatch(
        ctx.supabase,
        "model_metadata_evidence",
        changedEvidence,
        "model_id,source"
      );
      errors.push(...evidenceUpsert.errors);
    }

    let coreRowsUpdated = 0;
    const fieldFillCounts: Record<string, number> = {};
    const changelogRows: MetadataUpdateInsert[] = [];
    for (const { model, record } of matches) {
      const { patch, fields } = buildCoreGapPatch(model, record, observedAt);
      if (fields.length === 0) continue;

      let updateQuery = ctx.supabase
        .from("models")
        .update(patch)
        .eq("id", model.id);
      for (const field of fields) {
        updateQuery = updateQuery.is(field, null);
      }
      const { data: updatedRows, error } = await updateQuery.select("id");
      if (error) {
        errors.push({
          message: `Failed to fill model metadata gaps: ${error.message}`,
          context: `model=${model.slug}`,
        });
        continue;
      }
      if (!updatedRows || updatedRows.length === 0) continue;

      coreRowsUpdated += 1;
      for (const field of fields) {
        fieldFillCounts[field] = (fieldFillCounts[field] ?? 0) + 1;
      }
      const sourceUrl = extractHttpsUrls(record.links)[0] ?? DOCUMENTATION_URL;
      changelogRows.push({
        model_id: model.id,
        update_type: "metadata_verified",
        title: "Technical metadata verified",
        description: `Epoch AI evidence filled: ${fields.join(", ")}.`,
        source_url: sourceUrl,
        published_at: observedAt,
      });
    }

    if (changelogRows.length > 0) {
      errors.push(...(await insertModelUpdates(ctx, changelogRows)));
    }

    const newEvidenceCount = changedEvidence.filter(
      (candidate) => !existingByModelId.has(String(candidate.model_id))
    ).length;
    const changedExistingCount = changedEvidence.length - newEvidenceCount;
    const recentCutoff = Date.now() - 45 * 24 * 60 * 60 * 1_000;
    const unmatchedRecent = records
      .filter((record) => {
        const publication = Date.parse(record.publicationDate);
        if (!Number.isFinite(publication) || publication < recentCutoff) return false;
        return !matches.some(
          (match) =>
            normalizeEpochModelName(match.record.model) ===
              normalizeEpochModelName(record.model) &&
            providerMatchesEpochOrganization(
              match.model.provider,
              record.organization
            )
        );
      })
      .slice(0, 20)
      .map((record) => record.model);

    return {
      success: errors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: newEvidenceCount,
      recordsUpdated: changedExistingCount + coreRowsUpdated,
      errors,
      metadata: {
        datasetUrl: DATASET_URL,
        catalogModels: models.length,
        matchedModels: matches.length,
        evidenceChanged: changedEvidence.length,
        evidenceUnchanged: matches.length - changedEvidence.length,
        coreRowsUpdated,
        fieldFillCounts,
        unmatchedRecent,
        attribution: "Epoch AI, Data on AI Models (CC BY)",
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetchWithRetry(
        DATASET_URL,
        {
          method: "HEAD",
          headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" },
        },
        { maxRetries: 1, baseDelayMs: 500 }
      );
      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        message: response.ok
          ? "Epoch AI daily dataset reachable"
          : `Epoch AI returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  buildCoreGapPatch,
  buildEvidenceRecord,
  evidenceChanged,
  extractGitHubUrl,
  extractHuggingFaceModelId,
  extractHttpsUrls,
  getEpochProviderCandidates,
  matchEpochRecords,
  normalizeEpochModelName,
  parseEpochCsv,
  providerMatchesEpochOrganization,
  readResponseTextWithLimit,
};

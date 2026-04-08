import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch, makeSlug } from "../utils";
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

interface ProviderBenchmarkSource {
  id: string;
  provider: string;
  url: string;
  titleHint: string;
  modelHints: string[];
  publishedAtHint?: string;
  contentType?: "html" | "pdf";
}

type PdfParseModule = typeof import("pdf-parse");

let pdfParseModulePromise: Promise<PdfParseModule> | null = null;

async function loadPdfParse() {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = import("pdf-parse");
  }

  return pdfParseModulePromise;
}

const PROVIDER_PAGE_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};
const PROVIDER_FETCH_TIMEOUT_MS = 15000;
const PROVIDER_HEALTHCHECK_TIMEOUT_MS = 8000;

const BENCHMARK_KEYWORDS = [
  "benchmark",
  "benchmarks",
  "leaderboard",
  "leaderboards",
  "swe-bench",
  "livebench",
  "mmlu",
  "gpqa",
  "aime",
  "ifeval",
  "arena",
  "mathvista",
  "coding",
  "agent",
  "agents",
  "performance",
  "state-of-the-art",
];

const PROVIDER_BENCHMARK_SOURCES: ProviderBenchmarkSource[] = [
  {
    id: "openai-gpt-4-1",
    provider: "OpenAI",
    url: "https://openai.com/index/gpt-4-1/",
    titleHint: "GPT-4.1 benchmark update",
    modelHints: ["GPT-4.1", "GPT-4.1 mini", "GPT-4.1 nano"],
  },
  {
    id: "openai-gpt-5-1",
    provider: "OpenAI",
    url: "https://openai.com/index/gpt-5-1-for-developers/",
    titleHint: "GPT-5.1 benchmark update",
    modelHints: ["GPT-5.1", "GPT-5.1 mini", "GPT-5.1 nano"],
  },
  {
    id: "openai-gpt-5",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-5-for-developers/",
    titleHint: "GPT-5 benchmark update",
    modelHints: ["GPT-5", "GPT-5 mini", "GPT-5 nano", "gpt-5-chat-latest"],
  },
  {
    id: "openai-gpt-5-2",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-5-2",
    titleHint: "GPT-5.2 benchmark update",
    modelHints: ["GPT-5.2", "GPT-5.2 Pro"],
  },
  {
    id: "openai-gpt-5-2-codex",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-5-2-codex/",
    titleHint: "GPT-5.2-Codex benchmark update",
    modelHints: ["GPT-5.2-Codex", "GPT-5.2 Codex"],
  },
  {
    id: "openai-gpt-5-3-codex",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-5-3-codex/",
    titleHint: "GPT-5.3-Codex benchmark update",
    modelHints: ["GPT-5.3-Codex", "GPT-5.3 Codex"],
  },
  {
    id: "openai-gpt-5-4",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-5-4/",
    titleHint: "GPT-5.4 benchmark update",
    modelHints: ["GPT-5.4"],
  },
  {
    id: "openai-o3-o4-mini",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-o3-and-o4-mini/",
    titleHint: "o3 and o4-mini benchmark update",
    modelHints: ["o3", "o4-mini"],
  },
  {
    id: "anthropic-claude-4",
    provider: "Anthropic",
    url: "https://www.anthropic.com/news/claude-4",
    titleHint: "Claude 4 benchmark update",
    modelHints: ["Claude Opus 4", "Claude Sonnet 4"],
  },
  {
    id: "anthropic-claude-sonnet-4-6",
    provider: "Anthropic",
    url: "https://www.anthropic.com/news/claude-sonnet-4-6",
    titleHint: "Claude Sonnet 4.6 benchmark update",
    modelHints: ["Claude Sonnet 4.6"],
  },
  {
    id: "anthropic-claude-opus-4-6",
    provider: "Anthropic",
    url: "https://www.anthropic.com/news/claude-opus-4-6",
    titleHint: "Claude Opus 4.6 benchmark update",
    modelHints: ["Claude Opus 4.6"],
  },
  {
    id: "anthropic-claude-3-7-sonnet",
    provider: "Anthropic",
    url: "https://www.anthropic.com/news/claude-3-7-sonnet",
    titleHint: "Claude 3.7 Sonnet benchmark update",
    modelHints: ["Claude 3.7 Sonnet"],
  },
  {
    id: "google-gemini-2-5",
    provider: "Google",
    url: "https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/",
    titleHint: "Gemini 2.5 benchmark update",
    modelHints: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"],
  },
  {
    id: "google-gemini-computer-use",
    provider: "Google",
    url: "https://blog.google/technology/google-deepmind/gemini-computer-use-model/",
    titleHint: "Gemini computer-use benchmark update",
    modelHints: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"],
  },
  {
    id: "google-gemma-4-launch",
    provider: "Google",
    url: "https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/",
    titleHint: "Gemma 4 benchmark update",
    modelHints: [
      "Gemma 4",
      "Gemma 4 31B",
      "Gemma 4 31B IT",
      "Gemma 4 26B A4B IT",
      "Gemma 4 E4B IT",
      "Gemma 4 E2B IT",
    ],
  },
  {
    id: "xai-grok-4-1",
    provider: "xAI",
    url: "https://data.x.ai/2025-11-17-grok-4-1-model-card.pdf",
    titleHint: "Grok 4.1 benchmark update",
    modelHints: ["Grok 4.1"],
    contentType: "pdf",
  },
  {
    id: "xai-grok-4-fast",
    provider: "xAI",
    url: "https://data.x.ai/2025-09-19-grok-4-fast-model-card.pdf",
    titleHint: "Grok 4 Fast benchmark update",
    modelHints: ["Grok 4 Fast"],
    contentType: "pdf",
  },
  {
    id: "moonshot-kimi-api-newsletter",
    provider: "Moonshot AI",
    url: "https://platform.moonshot.ai/blog/posts/Kimi_API_Newsletter",
    titleHint: "Kimi API benchmark update",
    modelHints: ["Kimi K2", "Kimi"],
  },
  {
    id: "moonshot-k2-vendor-verifier",
    provider: "Moonshot AI",
    url: "https://platform.moonshot.ai/blog/posts/K2_Vendor_Verifier_Newsletter",
    titleHint: "Kimi K2 benchmark update",
    modelHints: ["Kimi K2", "K2"],
  },
  {
    id: "microsoft-harrier-oss",
    provider: "Microsoft",
    url: "https://huggingface.co/microsoft/harrier-oss-v1-27b",
    titleHint: "Harrier OSS benchmark update",
    modelHints: [
      "harrier-oss-v1-27b",
      "harrier-oss-v1-0.6b",
      "harrier-oss-v1-270m",
      "Harrier OSS",
    ],
  },
  {
    id: "microsoft-phi-4-reasoning-vision",
    provider: "Microsoft",
    url: "https://huggingface.co/microsoft/Phi-4-reasoning-vision-15B",
    titleHint: "Phi-4-Reasoning-Vision benchmark update",
    modelHints: ["Phi-4-reasoning-vision-15B", "Phi-4 Reasoning Vision 15B"],
  },
  {
    id: "microsoft-vibevoice-asr",
    provider: "Microsoft",
    url: "https://huggingface.co/microsoft/VibeVoice-ASR-HF",
    titleHint: "VibeVoice ASR benchmark update",
    modelHints: ["VibeVoice-ASR", "VibeVoice ASR"],
  },
  {
    id: "microsoft-bitnet-b1-58-2b-4t",
    provider: "Microsoft",
    url: "https://huggingface.co/microsoft/bitnet-b1.58-2B-4T",
    titleHint: "BitNet b1.58 2B4T benchmark update",
    modelHints: ["bitnet-b1.58-2B-4T", "BitNet b1.58 2B4T"],
  },
  {
    id: "nvidia-nemotron-cascade-2",
    provider: "NVIDIA",
    url: "https://huggingface.co/nvidia/Nemotron-Cascade-2-30B-A3B",
    titleHint: "Nemotron Cascade 2 benchmark update",
    modelHints: ["Nemotron-Cascade-2-30B-A3B", "Nemotron Cascade 2 30B A3B"],
  },
  {
    id: "nvidia-nemotron-terminal-32b",
    provider: "NVIDIA",
    url: "https://huggingface.co/nvidia/Nemotron-Terminal-32B",
    titleHint: "Nemotron Terminal 32B benchmark update",
    modelHints: ["Nemotron-Terminal-32B", "Nemotron Terminal 32B"],
  },
  {
    id: "nvidia-nemotron-ocr-v2",
    provider: "NVIDIA",
    url: "https://huggingface.co/nvidia/nemotron-ocr-v2",
    titleHint: "Nemotron OCR v2 benchmark update",
    modelHints: ["Nemotron OCR v2", "nemotron-ocr-v2"],
  },
  {
    id: "minimax-m2-1-coding",
    provider: "MiniMax",
    url: "https://www.minimaxi.com/news/m21-coding-%E5%A4%9A%E8%AF%AD%E8%A8%80%E5%A4%9A%E4%BB%BB%E5%8A%A1%E4%B8%8E%E6%B3%9B%E5%8C%96%E6%80%A7",
    titleHint: "MiniMax M2.1 coding benchmark update",
    modelHints: ["MiniMax M2.1", "M2.1"],
  },
  {
    id: "minimax-coding-agent-benchmark",
    provider: "MiniMax",
    url: "https://www.minimaxi.com/news/minimax-%E5%BC%80%E6%BA%90%E6%96%B0%E8%AF%84%E6%B5%8B%E9%9B%86%E5%AE%9A%E4%B9%89coding-agent-%E7%9A%84%E7%94%9F%E4%BA%A7%E7%BA%A7%E6%A0%87%E5%87%86",
    titleHint: "MiniMax coding agent benchmark update",
    modelHints: ["MiniMax M2.1", "MiniMax M2.5", "MiniMax M2.7", "MiniMax M1"],
  },
  {
    id: "minimax-m2-agent",
    provider: "MiniMax",
    url: "https://www.minimaxi.com/news/minimax-m2",
    titleHint: "MiniMax M2 benchmark update",
    modelHints: ["MiniMax M2", "MiniMax M2.1", "MiniMax M2.7"],
  },
  {
    id: "minimax-m2-1-generalization",
    provider: "MiniMax",
    url: "https://www.minimaxi.com/news/minimax-m21",
    titleHint: "MiniMax M2.1 benchmark update",
    modelHints: ["MiniMax M2", "MiniMax M2.1", "MiniMax M2.7"],
  },
  {
    id: "minimax-m2-1-agent-posttrain",
    provider: "MiniMax",
    url: "https://www.minimaxi.com/news/minimax-m21%E5%9C%A8-agent-%E5%9C%BA%E6%99%AF%E4%B8%8B%E7%9A%84%E5%90%8E%E8%AE%AD%E7%BB%83%E6%8A%80%E6%9C%AF%E4%B8%8E%E5%AE%9E%E8%B7%B5%E7%BB%8F%E9%AA%8C",
    titleHint: "MiniMax M2.1 agent benchmark update",
    modelHints: ["MiniMax M2", "MiniMax M2.1", "MiniMax M2.7"],
  },
  {
    id: "zai-glm-5",
    provider: "Z.ai",
    url: "https://docs.z.ai/guides/llm/glm-5",
    titleHint: "GLM-5 benchmark update",
    modelHints: ["GLM-5", "GLM-5 Turbo"],
  },
  {
    id: "zai-glm-5v-turbo",
    provider: "Z.ai",
    url: "https://docs.z.ai/guides/vlm/glm-5v-turbo",
    titleHint: "GLM-5V-Turbo benchmark update",
    modelHints: ["GLM-5V-Turbo", "GLM-5V Turbo"],
  },
  {
    id: "zai-glm-5-1",
    provider: "Z.ai",
    url: "https://huggingface.co/zai-org/GLM-5.1",
    titleHint: "GLM-5.1 benchmark update",
    modelHints: ["GLM-5.1", "GLM 5.1"],
  },
  {
    id: "zai-glm-ocr",
    provider: "Z.ai",
    url: "https://huggingface.co/zai-org/GLM-OCR",
    titleHint: "GLM-OCR benchmark update",
    modelHints: ["GLM-OCR", "GLM OCR"],
  },
  {
    id: "zai-glm-4-7",
    provider: "Z.ai",
    url: "https://docs.z.ai/guides/llm/glm-4.7",
    titleHint: "GLM-4.7 benchmark update",
    modelHints: ["GLM-4.7", "GLM-4.7 Flash", "GLM-4.7 FlashX"],
  },
  {
    id: "zai-glm-4-5",
    provider: "Z.ai",
    url: "https://docs.z.ai/guides/llm/glm-4.5",
    titleHint: "GLM-4.5 benchmark update",
    modelHints: ["GLM-4.5", "GLM-4.5V"],
  },
  {
    id: "zai-glm-4-6",
    provider: "Z.ai",
    url: "https://docs.z.ai/guides/llm/glm-4.6",
    titleHint: "GLM-4.6 benchmark update",
    modelHints: ["GLM-4.6", "GLM-4.6V"],
  },
  {
    id: "zai-llm-overview",
    provider: "Z.ai",
    url: "https://docs.z.ai/guides/llm",
    titleHint: "Z.ai benchmark overview",
    modelHints: ["GLM-5", "GLM 5 Turbo", "GLM-4.7", "GLM-4.6", "GLM-4.5"],
  },
];

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string) {
  const ogTitle =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1];
  if (ogTitle) return decodeHtml(ogTitle).trim();

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(stripHtml(title)) : null;
}

function extractDescription(html: string) {
  const metaDescription =
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1];
  if (metaDescription) return decodeHtml(metaDescription).trim();
  return null;
}

function extractPublishedAt(html: string) {
  const timeAttr = html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1];
  if (timeAttr) return new Date(timeAttr).toISOString();

  const articleTime =
    html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="article:published_time"/i)?.[1];
  if (articleTime) return new Date(articleTime).toISOString();

  const isoDate = html.match(/(\d{4}-\d{2}-\d{2})/i)?.[1];
  return isoDate ? `${isoDate}T00:00:00.000Z` : null;
}

function extractBenchmarkSnippet(html: string) {
  const text = stripHtml(html);
  return extractBenchmarkSnippetFromText(text);
}

function extractBenchmarkSnippetFromText(text: string) {
  if (!text) return null;

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const relevant = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return BENCHMARK_KEYWORDS.some((keyword) => lower.includes(keyword));
  });

  const summary = relevant.slice(0, 3).join(" ").slice(0, 480).trim();
  return summary || null;
}

function extractPdfTitle(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] ?? null;
}

function extractPdfPublishedAt(source: ProviderBenchmarkSource, text: string) {
  const urlDate = source.url.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (urlDate) return `${urlDate}T00:00:00.000Z`;

  const updatedMatch = text.match(
    /(?:Last updated|Updated|Published):?\s+([A-Z][a-z]+ \d{1,2}, \d{4})/
  )?.[1];
  if (!updatedMatch) return null;

  const parsed = new Date(updatedMatch);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractPdfSummary(source: ProviderBenchmarkSource, text: string) {
  const snippet = extractBenchmarkSnippetFromText(text);
  if (snippet) return snippet;

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized) return normalized.slice(0, 480).trim();

  return `${source.provider} published benchmark or leaderboard evidence for ${source.modelHints.join(", ")}.`;
}

function buildPdfFallbackRecord(source: ProviderBenchmarkSource) {
  return {
    title: source.titleHint,
    summary: `${source.provider} published official provider-reported benchmark evidence for ${source.modelHints.join(", ")}.`,
    publishedAt: source.publishedAtHint ?? extractPdfPublishedAt(source, source.url) ?? new Date().toISOString(),
  };
}

async function parseProviderSourceContent(
  source: ProviderBenchmarkSource,
  response: Response
) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const isPdf =
    source.contentType === "pdf" ||
    contentType.includes("application/pdf") ||
    source.url.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    try {
      const { PDFParse } = await loadPdfParse();
      const pdfBytes = new Uint8Array(await response.arrayBuffer());
      const parser = new PDFParse({ data: pdfBytes });
      try {
        const textResult = await parser.getText({ first: 3 });
        const text = textResult.text.replace(/\s+/g, " ").trim();
        const title = extractPdfTitle(text) ?? source.titleHint;
        return {
          title,
          summary: extractPdfSummary(source, text),
          publishedAt:
            extractPdfPublishedAt(source, text) ??
            source.publishedAtHint ??
            new Date().toISOString(),
        };
      } finally {
        await parser.destroy();
      }
    } catch {
      return buildPdfFallbackRecord(source);
    }
  }

  const html = await response.text();
  const title = extractTitle(html) ?? source.titleHint;
  const summary = buildRecordSummary(source, html);
  return {
    title,
    summary,
    publishedAt:
      extractPublishedAt(html) ?? source.publishedAtHint ?? new Date().toISOString(),
  };
}

function buildRecordSummary(
  source: ProviderBenchmarkSource,
  html: string
) {
  return (
    extractDescription(html) ??
    extractBenchmarkSnippet(html) ??
    `${source.provider} published benchmark or leaderboard evidence for ${source.modelHints.join(", ")}.`
  );
}

function buildRelationText(source: ProviderBenchmarkSource, title: string, summary: string) {
  return `${title} ${summary} ${source.modelHints.join(" ")}`.trim();
}

function buildRequestSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function buildModelRelations(
  source: ProviderBenchmarkSource,
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

  return limitProviderScopedModelIds(
    [...new Set(relation.modelIds)],
    8
  );
}

const adapter: DataSourceAdapter = {
  id: "provider-benchmarks",
  name: "Provider Benchmarks",
  outputTypes: ["news"],
  defaultConfig: {
    maxPages: PROVIDER_BENCHMARK_SOURCES.length,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages =
      (typeof ctx.config.maxPages === "number" ? ctx.config.maxPages : null) ??
      PROVIDER_BENCHMARK_SOURCES.length;

    const activeModels = await fetchAllActiveAliasModels(ctx.supabase);
    const lookup = await buildModelLookup(ctx.supabase);
    const aliasIndex = buildModelAliasIndex(activeModels);
    const records: Record<string, unknown>[] = [];
    const errors: Array<{ message: string; context?: string }> = [];
    let recordsProcessed = 0;

    for (const source of PROVIDER_BENCHMARK_SOURCES.slice(0, maxPages)) {
      recordsProcessed++;

      const response = await fetchWithRetry(
        source.url,
        {
          headers: PROVIDER_PAGE_HEADERS,
          signal: buildRequestSignal(ctx.signal, PROVIDER_FETCH_TIMEOUT_MS),
        },
        {
          signal: buildRequestSignal(ctx.signal, PROVIDER_FETCH_TIMEOUT_MS),
          maxRetries: 3,
          baseDelayMs: 1200,
        }
      ).catch((error) => error);

      if (response instanceof Error) {
        errors.push({
          message: `Failed to fetch ${source.url}: ${response.message}`,
          context: source.id,
        });
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        errors.push({
          message: `${source.url} returned HTTP ${response.status}: ${body.slice(0, 160)}`,
          context: source.id,
        });
        continue;
      }

      const { title, summary, publishedAt } = await parseProviderSourceContent(
        source,
        response
      );
      const relatedModelIds = buildModelRelations(
        source,
        title,
        summary,
        lookup,
        aliasIndex
      );
      records.push({
        source: "provider-benchmarks",
        source_id: `provider-benchmarks-${source.id}`,
        title,
        summary,
        url: source.url,
        published_at: publishedAt,
        category: "benchmark",
        related_provider: source.provider,
        related_model_ids: relatedModelIds,
        tags: [
          "benchmark",
          "provider-reported",
          "official",
          makeSlug(source.provider),
        ],
        metadata: {
          provider: source.provider,
          provider_reported: true,
          source_type: "official_provider_page",
          source_key: source.id,
          model_hints: source.modelHints,
          extracted_title: title,
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
      recordsUpdated: 0,
      errors: [...errors, ...upsertErrors],
      metadata: {
        sourceCount: PROVIDER_BENCHMARK_SOURCES.length,
        pagesFetched: records.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.all(
      PROVIDER_BENCHMARK_SOURCES.slice(0, 3).map(async (source) => {
        const startedAt = Date.now();
        try {
          const response = await fetchWithRetry(
            source.url,
            {
              headers: PROVIDER_PAGE_HEADERS,
              signal: buildRequestSignal(undefined, PROVIDER_HEALTHCHECK_TIMEOUT_MS),
            },
            {
              signal: buildRequestSignal(undefined, PROVIDER_HEALTHCHECK_TIMEOUT_MS),
              maxRetries: 1,
              baseDelayMs: 500,
            }
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
            checks.reduce((sum, check) => sum + check.latencyMs, 0) /
              checks.length
          )
        : 0;

    return {
      healthy: okCount > 0,
      latencyMs,
      message: `${okCount}/${checks.length} provider benchmark pages reachable`,
    };
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  extractTitle,
  extractDescription,
  extractPublishedAt,
  extractBenchmarkSnippet,
  extractBenchmarkSnippetFromText,
  extractPdfTitle,
  extractPdfPublishedAt,
  extractPdfSummary,
  buildPdfFallbackRecord,
  PROVIDER_PAGE_HEADERS,
};

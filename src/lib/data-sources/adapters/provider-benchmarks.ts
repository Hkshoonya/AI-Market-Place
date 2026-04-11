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
import {
  getTrustedBenchmarkHfUrl,
  getTrustedBenchmarkWebsiteUrl,
} from "../shared/benchmark-coverage";

interface ProviderBenchmarkSource {
  id: string;
  provider: string;
  url: string;
  titleHint: string;
  modelHints: string[];
  publishedAtHint?: string;
  contentType?: "html" | "pdf";
  sourceType?: "official_provider_page" | "official_model_card";
  requiresBenchmarkSignal?: boolean;
}

interface ProviderBenchmarkModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string | null;
  hf_model_id: string | null;
  website_url: string | null;
  release_date: string | null;
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
const BENCHMARK_MODEL_PAGE_SIZE = 1000;

const BENCHMARK_KEYWORDS = [
  "benchmark",
  "benchmarks",
  "evaluation",
  "evaluations",
  "evaluate",
  "evaluated",
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
  "effectiveness",
  "hallucination",
  "error rate",
];

const STRONG_BENCHMARK_KEYWORDS = [
  "benchmark",
  "benchmarks",
  "evaluation",
  "evaluations",
  "evaluate",
  "evaluated",
  "leaderboard",
  "leaderboards",
  "swe-bench",
  "livebench",
  "mmlu",
  "gpqa",
  "aime",
  "effectiveness",
  "hallucination",
  "error rate",
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
    modelHints: [
      "GPT-5",
      "GPT-5 mini",
      "GPT-5 nano",
      "gpt-5-chat-latest",
      "gpt-5-structured",
      "GPT-5 Structured",
    ],
  },
  {
    id: "openai-gpt-5-2",
    provider: "OpenAI",
    url: "https://openai.com/index/introducing-gpt-5-2",
    titleHint: "GPT-5.2 benchmark update",
    modelHints: ["GPT-5.2", "GPT-5.2 Chat", "gpt-5-2-chat", "GPT-5.2 Pro"],
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
    id: "openai-gpt-5-3-instant",
    provider: "OpenAI",
    url: "https://deploymentsafety.openai.com/gpt-5-3-instant/gpt-5-3-instant.pdf",
    titleHint: "GPT-5.3 Instant benchmark update",
    modelHints: ["GPT-5.3", "GPT-5.3 Chat"],
    contentType: "pdf",
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
    id: "google-gemma-4-26b-a4b",
    provider: "Google",
    url: "https://huggingface.co/google/gemma-4-26b-a4b",
    titleHint: "Gemma 4 26B A4B benchmark update",
    modelHints: ["Gemma 4 26B A4B", "gemma-4-26b-a4b"],
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
    id: "nvidia-gemma-4-31b-it-nvfp4",
    provider: "NVIDIA",
    url: "https://huggingface.co/nvidia/gemma-4-31b-it-nvfp4",
    titleHint: "Gemma 4 31B IT NVFP4 benchmark update",
    modelHints: ["Gemma 4 31B IT NVFP4", "gemma-4-31b-it-nvfp4"],
  },
  {
    id: "nvidia-nemotron-ocr-v2",
    provider: "NVIDIA",
    url: "https://huggingface.co/nvidia/nemotron-ocr-v2",
    titleHint: "Nemotron OCR v2 benchmark update",
    modelHints: ["Nemotron OCR v2", "nemotron-ocr-v2"],
  },
  {
    id: "nvidia-nemotron-3-super-120b-a12b",
    provider: "NVIDIA",
    url: "https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-FP8",
    titleHint: "Nemotron 3 Super benchmark update",
    modelHints: [
      "Nemotron 3 Super",
      "NVIDIA-Nemotron-3-Super-120B-A12B-FP8",
      "NVIDIA Nemotron 3 Super 120B A12B FP8",
    ],
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
    id: "zai-glm-asr-2512",
    provider: "Z.ai",
    url: "https://huggingface.co/zai-org/GLM-ASR-Nano-2512",
    titleHint: "GLM ASR 2512 benchmark update",
    modelHints: [
      "GLM-ASR-Nano-2512",
      "GLM ASR Nano 2512",
      "GLM ASR 2512",
    ],
  },
  {
    id: "amazon-nova-2-lite",
    provider: "Amazon",
    url: "https://docs.aws.amazon.com/pdfs/ai/responsible-ai/nova-2-lite/nova-2-lite.pdf",
    titleHint: "Nova 2 Lite benchmark update",
    modelHints: ["Nova 2 Lite", "Amazon Nova 2 Lite"],
    contentType: "pdf",
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

type AutoBenchmarkSourceCandidate = ProviderBenchmarkSource & {
  sourceType: "official_model_card" | "official_provider_page";
  releaseDate: string | null;
};

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

function hasBenchmarkSignal(text: string | null | undefined) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BENCHMARK_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function buildGenericBenchmarkSummary(source: ProviderBenchmarkSource) {
  const target =
    source.requiresBenchmarkSignal
      ? source.modelHints[0] ?? source.titleHint
      : source.modelHints.join(", ");

  return `${source.provider} published benchmark or leaderboard evidence for ${target}.`;
}

function isLowQualityBenchmarkSummary(summary: string | null) {
  if (!summary) return true;

  const lower = summary.toLowerCase();
  return (
    lower.includes("hugging face models datasets spaces") ||
    lower.includes("chat_template") ||
    lower.includes("<|im_start|") ||
    lower.includes("deployment and performance optimization best practices") ||
    lower.includes("window.hubconfig")
  );
}

function extractPdfTitle(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? null;
  if (!firstLine) return null;
  return firstLine.length <= 160 ? firstLine : null;
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
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const strongRelevantLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return STRONG_BENCHMARK_KEYWORDS.some((keyword) => lower.includes(keyword));
  });

  if (strongRelevantLines.length > 0) {
    return strongRelevantLines.slice(0, 3).join(" ").slice(0, 480).trim();
  }

  const relevantLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return BENCHMARK_KEYWORDS.some((keyword) => lower.includes(keyword));
  });

  if (relevantLines.length > 0) {
    const summary = relevantLines.slice(0, 3).join(" ").slice(0, 480).trim();
    if (!isLowQualityBenchmarkSummary(summary)) {
      return summary;
    }
  }

  const snippet = extractBenchmarkSnippetFromText(text);
  if (snippet && !isLowQualityBenchmarkSummary(snippet)) return snippet;

  return buildGenericBenchmarkSummary(source);
}

function buildPdfFallbackRecord(source: ProviderBenchmarkSource) {
  return {
    title: source.titleHint,
    summary: `${source.provider} published official provider-reported benchmark evidence for ${source.modelHints.join(", ")}.`,
    publishedAt: source.publishedAtHint ?? extractPdfPublishedAt(source, source.url) ?? new Date().toISOString(),
    hasBenchmarkSignal: false,
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
        const rawText = textResult.text.trim();
        const title = extractPdfTitle(rawText) ?? source.titleHint;
        return {
          title,
          summary: extractPdfSummary(source, rawText),
          publishedAt:
            extractPdfPublishedAt(source, rawText) ??
            source.publishedAtHint ??
            new Date().toISOString(),
          hasBenchmarkSignal: hasBenchmarkSignal(rawText),
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
  const description = extractDescription(html);
  const benchmarkSignal =
    hasBenchmarkSignal(stripHtml(html)) || hasBenchmarkSignal(description);
  return {
    title,
    summary,
    publishedAt:
      extractPublishedAt(html) ?? source.publishedAtHint ?? new Date().toISOString(),
    hasBenchmarkSignal: benchmarkSignal,
  };
}

function buildRecordSummary(
  source: ProviderBenchmarkSource,
  html: string
) {
  if (source.url.includes("huggingface.co")) {
    return buildGenericBenchmarkSummary(source);
  }

  const snippet = extractBenchmarkSnippet(html);
  if (snippet && !isLowQualityBenchmarkSummary(snippet)) {
    return snippet;
  }

  const description = extractDescription(html);
  if (description && !isLowQualityBenchmarkSummary(description)) {
    return description;
  }

  return (
    buildGenericBenchmarkSummary(source)
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

async function fetchBenchmarkCandidateModels(
  supabase: SyncContext["supabase"]
) {
  const models: ProviderBenchmarkModel[] = [];

  for (let from = 0; ; from += BENCHMARK_MODEL_PAGE_SIZE) {
    const to = from + BENCHMARK_MODEL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("models")
      .select(
        "id, slug, name, provider, category, hf_model_id, website_url, release_date"
      )
      .eq("status", "active")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch benchmark candidate models: ${error.message}`);
    }

    const rows = (data ?? []) as ProviderBenchmarkModel[];
    models.push(...rows);

    if (rows.length < BENCHMARK_MODEL_PAGE_SIZE) break;
  }

  return models;
}

async function fetchCoveredBenchmarkModelIds(
  supabase: SyncContext["supabase"]
) {
  const coveredIds = new Set<string>();

  for (let from = 0; ; from += BENCHMARK_MODEL_PAGE_SIZE) {
    const to = from + BENCHMARK_MODEL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("benchmark_scores")
      .select("model_id")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch benchmark score coverage: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      if (typeof row.model_id === "string") {
        coveredIds.add(row.model_id);
      }
    }

    if (rows.length < BENCHMARK_MODEL_PAGE_SIZE) break;
  }

  for (let from = 0; ; from += BENCHMARK_MODEL_PAGE_SIZE) {
    const to = from + BENCHMARK_MODEL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("model_news")
      .select("related_model_ids")
      .eq("category", "benchmark")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch benchmark news coverage: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      for (const modelId of row.related_model_ids ?? []) {
        coveredIds.add(modelId);
      }
    }

    if (rows.length < BENCHMARK_MODEL_PAGE_SIZE) break;
  }

  return coveredIds;
}

async function fetchExistingAutoBenchmarkSourceIds(
  supabase: SyncContext["supabase"]
) {
  const sourceIds = new Set<string>();

  for (let from = 0; ; from += BENCHMARK_MODEL_PAGE_SIZE) {
    const to = from + BENCHMARK_MODEL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("model_news")
      .select("source_id")
      .eq("source", "provider-benchmarks")
      .or("source_id.like.provider-benchmarks-auto-hf-%,source_id.like.provider-benchmarks-auto-web-%")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch auto benchmark sources: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      if (typeof row.source_id === "string") {
        sourceIds.add(row.source_id);
      }
    }

    if (rows.length < BENCHMARK_MODEL_PAGE_SIZE) break;
  }

  return sourceIds;
}

function buildAutoBenchmarkModelHints(model: ProviderBenchmarkModel) {
  const hints = new Set<string>([model.name, model.slug]);

  const hfTail = model.hf_model_id?.split("/").pop();
  if (hfTail) {
    hints.add(hfTail);
  }

  const providerSlug = makeSlug(model.provider);
  if (providerSlug && model.slug.startsWith(providerSlug + "-")) {
    hints.add(model.slug.slice(providerSlug.length + 1));
  }

  return [...hints].filter(Boolean);
}

function buildAutoBenchmarkSources(
  models: ProviderBenchmarkModel[],
  coveredModelIds: Set<string>,
  existingAutoSourceIds: Set<string>,
  autoMaxPages: number
) {
  const curatedUrls = new Set(
    PROVIDER_BENCHMARK_SOURCES.map((source) => source.url)
  );
  const candidates: AutoBenchmarkSourceCandidate[] = [];

  for (const model of models) {
    const hfSourceId = `provider-benchmarks-auto-hf-${makeSlug(model.slug)}`;
    const websiteSourceId = `provider-benchmarks-auto-web-${makeSlug(model.slug)}`;
    const hasExistingAutoSource =
      existingAutoSourceIds.has(hfSourceId) ||
      existingAutoSourceIds.has(websiteSourceId);
    if (
      coveredModelIds.has(model.id) &&
      !hasExistingAutoSource
    ) {
      continue;
    }

    const trustedHfUrl = getTrustedBenchmarkHfUrl(model);
    const trustedWebsiteUrl = getTrustedBenchmarkWebsiteUrl(model);
    const modelHints = buildAutoBenchmarkModelHints(model);
    const locatorCandidates = [
      {
        url: trustedHfUrl,
        sourceId: hfSourceId,
        sourceType: "official_model_card" as const,
      },
      {
        url: trustedWebsiteUrl,
        sourceId: websiteSourceId,
        sourceType: "official_provider_page" as const,
      },
    ];

    for (const locator of locatorCandidates) {
      if (!locator.url || curatedUrls.has(locator.url)) continue;
      if (coveredModelIds.has(model.id) && !existingAutoSourceIds.has(locator.sourceId)) {
        continue;
      }

      candidates.push({
        id: locator.sourceId.replace("provider-benchmarks-", ""),
        provider: model.provider,
        url: locator.url,
        titleHint: `${model.name} benchmark update`,
        modelHints,
        sourceType: locator.sourceType,
        requiresBenchmarkSignal: true,
        releaseDate: model.release_date,
      });
    }
  }

  return candidates
    .sort(
      (left, right) =>
        Date.parse(right.releaseDate ?? "0") - Date.parse(left.releaseDate ?? "0")
    )
    .slice(0, autoMaxPages)
    .map(({ releaseDate: _releaseDate, ...source }) => source);
}

const adapter: DataSourceAdapter = {
  id: "provider-benchmarks",
  name: "Provider Benchmarks",
  outputTypes: ["news"],
  defaultConfig: {
    maxPages: PROVIDER_BENCHMARK_SOURCES.length,
    autoMaxPages: 100,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages =
      (typeof ctx.config.maxPages === "number" ? ctx.config.maxPages : null) ??
      PROVIDER_BENCHMARK_SOURCES.length;
    const autoMaxPages =
      (typeof ctx.config.autoMaxPages === "number"
        ? ctx.config.autoMaxPages
        : null) ?? 100;

    const activeModels = await fetchAllActiveAliasModels(ctx.supabase);
    const benchmarkCandidateModels = await fetchBenchmarkCandidateModels(ctx.supabase);
    const coveredBenchmarkModelIds = await fetchCoveredBenchmarkModelIds(ctx.supabase);
    const existingAutoSourceIds = await fetchExistingAutoBenchmarkSourceIds(ctx.supabase);
    const lookup = await buildModelLookup(ctx.supabase);
    const aliasIndex = buildModelAliasIndex(activeModels);
    const sources = [
      ...PROVIDER_BENCHMARK_SOURCES.slice(0, maxPages),
      ...buildAutoBenchmarkSources(
        benchmarkCandidateModels,
        coveredBenchmarkModelIds,
        existingAutoSourceIds,
        autoMaxPages
      ),
    ];
    const records: Record<string, unknown>[] = [];
    const errors: Array<{ message: string; context?: string }> = [];
    let recordsProcessed = 0;
    let autoSkippedWithoutBenchmarkSignal = 0;

    for (const source of sources) {
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

      const parsedContent = await parseProviderSourceContent(source, response);
      if (
        source.requiresBenchmarkSignal &&
        !parsedContent.hasBenchmarkSignal
      ) {
        autoSkippedWithoutBenchmarkSignal += 1;
        continue;
      }
      const relatedModelIds = buildModelRelations(
        source,
        parsedContent.title,
        parsedContent.summary,
        lookup,
        aliasIndex
      );
      records.push({
        source: "provider-benchmarks",
        source_id: `provider-benchmarks-${source.id}`,
        title: parsedContent.title,
        summary: parsedContent.summary,
        url: source.url,
        published_at: parsedContent.publishedAt,
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
          source_type: source.sourceType ?? "official_provider_page",
          source_key: source.id,
          model_hints: source.modelHints,
          extracted_title: parsedContent.title,
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
        sourceCount: sources.length,
        curatedSourceCount: Math.min(maxPages, PROVIDER_BENCHMARK_SOURCES.length),
        autoSourceCount: Math.max(
          0,
          sources.length - Math.min(maxPages, PROVIDER_BENCHMARK_SOURCES.length)
        ),
        autoSkippedWithoutBenchmarkSignal,
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
  buildAutoBenchmarkSources,
  buildAutoBenchmarkModelHints,
  PROVIDER_PAGE_HEADERS,
};

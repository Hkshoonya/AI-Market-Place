import { getCanonicalProviderName } from "@/lib/constants/providers";

export interface BenchmarkExpectedModel {
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
  name?: string | null;
}

const AUTO_HF_BENCHMARK_PROVIDER_ORGS: Record<string, string[]> = {
  Alibaba: ["Qwen"],
  Bytedance: ["ByteDance-Seed"],
  DeepSeek: ["deepseek-ai"],
  Google: ["google"],
  Meta: ["meta-llama"],
  "Mistral AI": ["mistralai"],
  Microsoft: ["microsoft"],
  NVIDIA: ["nvidia"],
  OpenAI: ["openai"],
  Qwen: ["Qwen"],
  "Z.ai": ["zai-org"],
  MiniMax: ["minimaxai"],
};

const TRUSTED_BENCHMARK_WEBSITE_HOSTS: Record<string, string[]> = {
  OpenAI: ["openai.com", "platform.openai.com", "developers.openai.com"],
  Anthropic: ["anthropic.com"],
  Google: ["ai.google.dev", "blog.google", "cloud.google.com", "deepmind.google"],
  xAI: ["x.ai", "docs.x.ai", "data.x.ai"],
  Meta: ["ai.meta.com", "llama.com", "meta.com"],
  "Mistral AI": ["mistral.ai", "docs.mistral.ai"],
  Qwen: ["qwen.ai", "qwenlm.github.io", "alibabacloud.com"],
  Alibaba: ["qwen.ai", "qwenlm.github.io", "alibabacloud.com"],
  DeepSeek: ["deepseek.com", "api-docs.deepseek.com"],
  "Moonshot AI": [
    "moonshot.ai",
    "www.moonshot.ai",
    "platform.moonshot.ai",
    "platform.kimi.com",
    "kimi.com",
    "www.kimi.com",
  ],
  Cohere: ["cohere.com", "docs.cohere.com"],
  "Z.ai": ["z.ai", "www.z.ai", "docs.z.ai"],
  MiniMax: ["minimax.io", "www.minimax.io", "platform.minimax.io"],
  Microsoft: ["microsoft.com", "azure.microsoft.com", "ai.azure.com", "huggingface.co"],
  NVIDIA: ["nvidia.com", "build.nvidia.com", "huggingface.co"],
  Amazon: ["aws.amazon.com", "docs.aws.amazon.com"],
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferTrustedBenchmarkHfModelId(
  model: BenchmarkExpectedModel
): string | null {
  const provider = getCanonicalProviderName(model.provider);
  const slug = String(model.slug ?? "").toLowerCase();

  if (provider === "Bytedance" && slug.includes("ui-tars-1-5-7b")) {
    return "ByteDance-Seed/UI-TARS-1.5-7B";
  }

  return null;
}

function inferTrustedBenchmarkWebsiteCandidate(
  model: BenchmarkExpectedModel
): string | null {
  const provider = getCanonicalProviderName(model.provider);
  const slug = String(model.slug ?? "").toLowerCase();
  const text = `${slug} ${normalizeText(model.name)}`;

  if (provider === "OpenAI") {
    if (model.category === "speech_audio" || /\b(transcribe|speech|audio|whisper)\b/.test(text)) {
      return "https://developers.openai.com/api/docs/guides/speech-to-text";
    }
    return "https://developers.openai.com/api/docs/models";
  }

  if (provider === "Google") {
    if (text.includes("gemma")) {
      return "https://deepmind.google/models/gemma/";
    }
    if (text.includes("gemini")) {
      return "https://ai.google.dev/gemini-api/docs/models";
    }
  }

  if (provider === "MiniMax") {
    if (model.category === "speech_audio") {
      return "https://www.minimax.io/models/audio";
    }
    return "https://www.minimax.io/models/text";
  }

  if (provider === "Moonshot AI") {
    if (/\bk2(?:\s|[-_.])?6\b/.test(text) || text.includes("kimi k2 6")) {
      return "https://www.kimi.com/blog/kimi-k2-6";
    }

    return "https://platform.kimi.com/docs/models";
  }

  if (provider === "Z.ai") {
    if (model.category === "multimodal" || model.category === "vision") {
      return "https://docs.z.ai/guides/vlm";
    }
    if (model.category === "speech_audio") {
      return "https://docs.z.ai/guides/audio";
    }
    return "https://docs.z.ai/guides/llm";
  }

  if (provider === "Mistral AI" && text.includes("saba")) {
    return "https://mistral.ai/news/mistral-saba/";
  }

  if (provider === "NVIDIA") {
    return "https://build.nvidia.com/models";
  }

  if (provider === "Microsoft") {
    return "https://ai.azure.com/explore/models";
  }

  if (provider === "Meta" && text.includes("llama")) {
    return "https://www.llama.com/";
  }

  return null;
}

export function inferTrustedBenchmarkLocatorHints(
  model: BenchmarkExpectedModel
): {
  hf_model_id: string | null;
  website_url: string | null;
} {
  return {
    hf_model_id: inferTrustedBenchmarkHfModelId(model),
    website_url: inferTrustedBenchmarkWebsiteCandidate(model),
  };
}

export function isBenchmarkExpectedModel(model: {
  category: string | null;
  slug: string;
  provider: string;
}) {
  const category = model.category ?? "";
  const text = `${model.provider} ${model.slug}`.toLowerCase();

  if (category === "llm" || category === "multimodal") {
    return true;
  }

  if (category === "vision") {
    return /\b(ocr|doc|docvqa|vqa|parse|chart|screen)\b/.test(text);
  }

  if (category === "speech_audio") {
    return /\b(asr|stt|whisper|transcribe|transcription|speech[- ]to[- ]text|voice[- ]transcription)\b/.test(
      text
    );
  }

  if (category === "specialized") {
    return /\b(ocr|asr|transcribe|reasoning|terminal|code|coder|math)\b/.test(text);
  }

  return false;
}

export function getTrustedBenchmarkHfUrl(
  model: BenchmarkExpectedModel
): string | null {
  const inferred = inferTrustedBenchmarkLocatorHints(model);
  const hfModelId = model.hf_model_id?.trim() || inferred.hf_model_id;
  if (!hfModelId) return null;
  if (!isBenchmarkExpectedModel(model)) return null;

  const [org] = hfModelId.split("/");
  if (!org) return null;

  const provider = getCanonicalProviderName(model.provider);
  const allowedOrgs = AUTO_HF_BENCHMARK_PROVIDER_ORGS[provider] ?? [];
  const normalizedOrg = org.toLowerCase();
  const isTrustedOrg = allowedOrgs.some(
    (allowedOrg) => allowedOrg.toLowerCase() === normalizedOrg
  );

  if (!isTrustedOrg) return null;

  return `https://huggingface.co/${hfModelId}`;
}

export function getTrustedBenchmarkWebsiteUrl(
  model: BenchmarkExpectedModel
): string | null {
  const inferred = inferTrustedBenchmarkLocatorHints(model);
  const websiteUrl = model.website_url?.trim() || inferred.website_url;
  if (!websiteUrl) return null;
  if (!isBenchmarkExpectedModel(model)) return null;

  let host: string;
  try {
    host = new URL(websiteUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const provider = getCanonicalProviderName(model.provider);
  const allowedHosts = TRUSTED_BENCHMARK_WEBSITE_HOSTS[provider] ?? [];
  const isTrustedHost = allowedHosts.some(
    (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
  );

  if (!isTrustedHost) return null;

  return websiteUrl;
}

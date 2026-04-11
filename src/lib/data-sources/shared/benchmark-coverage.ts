export interface BenchmarkExpectedModel {
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
}

const AUTO_HF_BENCHMARK_PROVIDER_ORGS: Record<string, string[]> = {
  Alibaba: ["Qwen"],
  DeepSeek: ["deepseek-ai"],
  Google: ["google"],
  Meta: ["meta-llama"],
  "Mistral AI": ["mistralai"],
  Microsoft: ["microsoft"],
  NVIDIA: ["nvidia"],
  Qwen: ["Qwen"],
  "Z.ai": ["zai-org"],
  MiniMax: ["minimaxai"],
};

const TRUSTED_BENCHMARK_WEBSITE_HOSTS: Record<string, string[]> = {
  OpenAI: ["openai.com", "platform.openai.com"],
  Anthropic: ["anthropic.com"],
  Google: ["ai.google.dev", "blog.google", "cloud.google.com"],
  xAI: ["x.ai", "docs.x.ai", "data.x.ai"],
  Meta: ["ai.meta.com", "llama.com", "meta.com"],
  "Mistral AI": ["mistral.ai", "docs.mistral.ai"],
  Qwen: ["qwen.ai", "qwenlm.github.io", "alibabacloud.com"],
  Alibaba: ["qwen.ai", "qwenlm.github.io", "alibabacloud.com"],
  DeepSeek: ["deepseek.com", "api-docs.deepseek.com"],
  "Moonshot AI": ["moonshot.ai", "platform.moonshot.ai", "kimi.com", "www.kimi.com"],
  Cohere: ["cohere.com", "docs.cohere.com"],
  "Z.ai": ["z.ai", "www.z.ai", "docs.z.ai"],
  MiniMax: ["minimax.io", "www.minimax.io", "platform.minimax.io"],
  Microsoft: ["microsoft.com", "azure.microsoft.com", "huggingface.co"],
  NVIDIA: ["nvidia.com", "build.nvidia.com", "huggingface.co"],
  Amazon: ["aws.amazon.com", "docs.aws.amazon.com"],
};

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
    return /\b(asr|transcribe|transcription|speech|stt)\b/.test(text);
  }

  if (category === "specialized") {
    return /\b(ocr|asr|transcribe|reasoning|terminal|code|coder|math)\b/.test(text);
  }

  return false;
}

export function getTrustedBenchmarkHfUrl(
  model: BenchmarkExpectedModel
): string | null {
  const hfModelId = model.hf_model_id?.trim();
  if (!hfModelId) return null;
  if (!isBenchmarkExpectedModel(model)) return null;

  const [org] = hfModelId.split("/");
  if (!org) return null;

  const allowedOrgs = AUTO_HF_BENCHMARK_PROVIDER_ORGS[model.provider] ?? [];
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
  const websiteUrl = model.website_url?.trim();
  if (!websiteUrl) return null;
  if (!isBenchmarkExpectedModel(model)) return null;

  let host: string;
  try {
    host = new URL(websiteUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const allowedHosts = TRUSTED_BENCHMARK_WEBSITE_HOSTS[model.provider] ?? [];
  const isTrustedHost = allowedHosts.some(
    (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
  );

  if (!isTrustedHost) return null;

  return websiteUrl;
}

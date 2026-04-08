export interface BenchmarkExpectedModel {
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
}

const AUTO_HF_BENCHMARK_PROVIDER_ORGS: Record<string, string[]> = {
  Google: ["google"],
  Microsoft: ["microsoft"],
  NVIDIA: ["nvidia"],
  "Z.ai": ["zai-org"],
  MiniMax: ["minimaxai"],
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

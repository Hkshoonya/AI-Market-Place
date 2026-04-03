export interface SelfHostRequirementsInput {
  isOpenWeights: boolean | null | undefined;
  parameterCount?: number | null;
  contextWindow?: number | null;
  modalities?: string[] | null;
  category?: string | null;
  name?: string | null;
  slug?: string | null;
}

export interface SelfHostRequirementsSummary {
  setup: string;
  hardware: string;
  sizeLabel: string | null;
  notes: string[];
  shortLabel: string;
  tier: "personal" | "desktop_gpu" | "cloud_gpu" | "high_memory_cloud";
}

export interface ProviderSelfHostSummary {
  openModelCount: number;
  personalCount: number;
  desktopGpuCount: number;
  cloudGpuCount: number;
  highMemoryCloudCount: number;
  headline: string;
  detail: string;
}

export function formatParameterCountCompact(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}B parameters`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M parameters`;
  return `${value.toLocaleString()} parameters`;
}

function inferParameterCountFromText(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(?:^|[\s-])(\d+(?:\.\d+)?)\s*b(?:\b|[-\s])/i);
  if (!match) return null;

  const billions = Number(match[1]);
  if (!Number.isFinite(billions) || billions <= 0) return null;
  return billions * 1_000_000_000;
}

export function getSelfHostRequirements(
  input: SelfHostRequirementsInput
): SelfHostRequirementsSummary | null {
  if (!input.isOpenWeights) return null;

  const parameterCount =
    input.parameterCount ??
    inferParameterCountFromText(input.name) ??
    inferParameterCountFromText(input.slug) ??
    null;
  const parameterBillions =
    parameterCount && parameterCount > 0 ? parameterCount / 1_000_000_000 : null;
  const modalities = new Set((input.modalities ?? []).map((item) => item.toLowerCase()));
  const isVideo = input.category === "video" || modalities.has("video");
  const isMultimodal =
    input.category === "multimodal" ||
    modalities.has("image") ||
    modalities.has("audio") ||
    modalities.has("vision");

  let setup = "A modern desktop or laptop may be enough.";
  let hardware =
    "Start with the simplest local runtime above and move to cloud hardware only if it feels slow.";
  let shortLabel = "Can likely run on your own machine";
  let tier: SelfHostRequirementsSummary["tier"] = "personal";

  if (isVideo) {
    setup = "A rented cloud GPU is the realistic default.";
    hardware =
      "Video models usually need high-memory cloud GPUs and are rarely comfortable on a normal laptop.";
    shortLabel = "Likely needs a high-memory cloud GPU";
    tier = "high_memory_cloud";
  } else if (parameterBillions != null && parameterBillions >= 60) {
    setup = "A rented cloud GPU server is strongly recommended.";
    hardware =
      "Plan for roughly 80GB+ GPU memory, and some variants may need more than one GPU.";
    shortLabel = "Likely needs a high-memory cloud GPU";
    tier = "high_memory_cloud";
  } else if (parameterBillions != null && parameterBillions >= 20) {
    setup = "A strong GPU or rented cloud server is usually needed.";
    hardware = "Plan for roughly 48GB+ GPU memory for a smooth setup.";
    shortLabel = "Likely needs a rented cloud GPU";
    tier = "cloud_gpu";
  } else if (parameterBillions != null && parameterBillions >= 8) {
    setup = "A good desktop GPU or small cloud GPU is usually enough.";
    hardware = "Plan for roughly 16GB to 24GB of GPU memory.";
    shortLabel = "Desktop GPU should be enough";
    tier = "desktop_gpu";
  } else if (parameterBillions != null && parameterBillions >= 3) {
    setup = "A consumer GPU is usually enough.";
    hardware = "Plan for roughly 8GB to 16GB of GPU memory.";
    shortLabel = "Consumer GPU should be enough";
    tier = "desktop_gpu";
  }

  const notes: string[] = [];
  if (isMultimodal && !isVideo) {
    notes.push("Image and audio features usually need more memory than text-only use.");
  }
  if ((input.contextWindow ?? 0) >= 200_000) {
    notes.push(
      "Very long context windows increase memory use, especially when you push the model hard."
    );
  }
  notes.push("Quantized builds can run on less hardware, but they may trade off speed or quality.");

  return {
    setup,
    hardware,
    sizeLabel: formatParameterCountCompact(parameterCount),
    notes,
    shortLabel,
    tier,
  };
}

export function summarizeProviderSelfHostRequirements(
  models: SelfHostRequirementsInput[]
): ProviderSelfHostSummary | null {
  const summaries = models
    .map((model) => getSelfHostRequirements(model))
    .filter((summary): summary is SelfHostRequirementsSummary => Boolean(summary));

  if (summaries.length === 0) return null;

  const counts = {
    personal: 0,
    desktop_gpu: 0,
    cloud_gpu: 0,
    high_memory_cloud: 0,
  } as const;
  const mutableCounts = { ...counts };

  for (const summary of summaries) {
    mutableCounts[summary.tier] += 1;
  }

  const openModelCount = summaries.length;
  const cloudHeavyCount = mutableCounts.cloud_gpu + mutableCounts.high_memory_cloud;

  let headline = "Most open models here can run on your own hardware.";
  if (mutableCounts.high_memory_cloud > 0 && mutableCounts.high_memory_cloud >= Math.ceil(openModelCount / 3)) {
    headline = "Many open models here need high-memory cloud GPUs.";
  } else if (cloudHeavyCount >= Math.ceil(openModelCount / 2)) {
    headline = "Most open models here are better on rented cloud GPUs.";
  } else if (mutableCounts.desktop_gpu >= Math.ceil(openModelCount / 2)) {
    headline = "Most open models here expect a real desktop GPU.";
  }

  const detail = `${mutableCounts.personal} easy personal-hardware fits · ${mutableCounts.desktop_gpu} desktop GPU fits · ${mutableCounts.cloud_gpu} cloud GPU fits · ${mutableCounts.high_memory_cloud} high-memory cloud fits`;

  return {
    openModelCount,
    personalCount: mutableCounts.personal,
    desktopGpuCount: mutableCounts.desktop_gpu,
    cloudGpuCount: mutableCounts.cloud_gpu,
    highMemoryCloudCount: mutableCounts.high_memory_cloud,
    headline,
    detail,
  };
}

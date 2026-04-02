export interface SelfHostRequirementsInput {
  isOpenWeights: boolean | null | undefined;
  parameterCount?: number | null;
  contextWindow?: number | null;
  modalities?: string[] | null;
  category?: string | null;
}

export interface SelfHostRequirementsSummary {
  setup: string;
  hardware: string;
  sizeLabel: string | null;
  notes: string[];
  shortLabel: string;
}

export function formatParameterCountCompact(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}B parameters`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M parameters`;
  return `${value.toLocaleString()} parameters`;
}

export function getSelfHostRequirements(
  input: SelfHostRequirementsInput
): SelfHostRequirementsSummary | null {
  if (!input.isOpenWeights) return null;

  const parameterCount = input.parameterCount ?? null;
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

  if (isVideo) {
    setup = "A rented cloud GPU is the realistic default.";
    hardware =
      "Video models usually need high-memory cloud GPUs and are rarely comfortable on a normal laptop.";
    shortLabel = "Likely needs a high-memory cloud GPU";
  } else if (parameterBillions != null && parameterBillions >= 60) {
    setup = "A rented cloud GPU server is strongly recommended.";
    hardware =
      "Plan for roughly 80GB+ GPU memory, and some variants may need more than one GPU.";
    shortLabel = "Likely needs a high-memory cloud GPU";
  } else if (parameterBillions != null && parameterBillions >= 20) {
    setup = "A strong GPU or rented cloud server is usually needed.";
    hardware = "Plan for roughly 48GB+ GPU memory for a smooth setup.";
    shortLabel = "Likely needs a rented cloud GPU";
  } else if (parameterBillions != null && parameterBillions >= 8) {
    setup = "A good desktop GPU or small cloud GPU is usually enough.";
    hardware = "Plan for roughly 16GB to 24GB of GPU memory.";
    shortLabel = "Desktop GPU should be enough";
  } else if (parameterBillions != null && parameterBillions >= 3) {
    setup = "A consumer GPU is usually enough.";
    hardware = "Plan for roughly 8GB to 16GB of GPU memory.";
    shortLabel = "Consumer GPU should be enough";
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
  };
}

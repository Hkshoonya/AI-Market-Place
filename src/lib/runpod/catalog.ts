// Deliberately small, reviewed launch catalog. Catalog listings alone are not
// evidence that a model fits a GPU or can be served without remote code.
export const RUNPOD_MODELS = [
  {
    key: "qwen3-4b-instruct",
    name: "Qwen3 4B Instruct 2507",
    repository: "Qwen/Qwen3-4B-Instruct-2507",
    revision: "cdbee75f17c01a7cc42f958dc650907174af0554",
    minimumVramGb: 24,
    license: "Apache-2.0",
  },
  {
    key: "qwen3-8b",
    name: "Qwen3 8B",
    repository: "Qwen/Qwen3-8B",
    revision: "b968826d9c46dd6066d109eabc6255188de91218",
    minimumVramGb: 24,
    license: "Apache-2.0",
  },
] as const;

export function getRunpodModel(key: string) {
  return RUNPOD_MODELS.find((model) => model.key === key);
}

export const RUNPOD_CONTAINER_GB = 30;
export const RUNPOD_VOLUMES = [30, 50, 100] as const;

export interface RunpodGpu {
  id: string;
  name: string;
  memoryGb: number;
  pricePerHour: number;
  stock: string;
}

export interface PublicRunpodPod {
  id: string;
  modelKey: string;
  modelName: string;
  gpuName: string;
  volumeGb: number;
  estimatedGpuPricePerHour: number;
  observedPricePerHour: number | null;
  status: string;
  apiReady: boolean;
  endpointUrl: string | null;
  consoleUrl: string;
  quoteExpiresAt: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

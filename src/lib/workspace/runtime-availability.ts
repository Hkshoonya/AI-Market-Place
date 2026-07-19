import {
  resolveWorkspaceRuntimeExecution,
  type WorkspaceRuntimeExecution,
  type WorkspaceRuntimePricing,
} from "./runtime-execution";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CATALOG_TTL_MS = 5 * 60 * 1000;

let openRouterCatalogCache:
  | {
      expiresAt: number;
      models: Map<string, { pricing: WorkspaceRuntimePricing | null }>;
    }
  | null = null;
let openRouterCatalogRequest: Promise<
  Map<string, { pricing: WorkspaceRuntimePricing | null }>
> | null = null;

function parseNonnegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOpenRouterPricing(value: unknown): WorkspaceRuntimePricing | null {
  if (!value || typeof value !== "object") return null;
  const pricing = value as Record<string, unknown>;
  const inputPerToken = parseNonnegativeNumber(pricing.prompt);
  const outputPerToken = parseNonnegativeNumber(pricing.completion);
  const request = parseNonnegativeNumber(pricing.request) ?? 0;

  if (inputPerToken === null && outputPerToken === null && request === 0) {
    return null;
  }

  return {
    inputPerToken,
    outputPerToken,
    request,
    currency: "USD",
    source: "openrouter",
  };
}

async function fetchOpenRouterModels(apiKey: string) {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://aimarketcap.tech",
      "X-Title": "AI Market Cap",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: Array<{ id?: unknown; pricing?: unknown }> }
    | null;

  if (!response.ok || !Array.isArray(payload?.data)) {
    throw new Error(`OpenRouter model catalog returned HTTP ${response.status}`);
  }

  const models = new Map<string, { pricing: WorkspaceRuntimePricing | null }>();
  for (const item of payload.data) {
    if (typeof item.id !== "string" || !item.id) continue;
    models.set(item.id, { pricing: parseOpenRouterPricing(item.pricing) });
  }

  return models;
}

async function loadOpenRouterModels(explicitApiKey?: string) {
  const userApiKey = explicitApiKey?.trim();
  if (userApiKey) {
    // Provider catalogs can differ by account. Never share a user-key result.
    return fetchOpenRouterModels(userApiKey);
  }

  const now = Date.now();
  if (openRouterCatalogCache && openRouterCatalogCache.expiresAt > now) {
    return openRouterCatalogCache.models;
  }

  if (openRouterCatalogRequest) {
    return openRouterCatalogRequest;
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenRouter is not configured");
  }

  openRouterCatalogRequest = (async () => {
    const models = await fetchOpenRouterModels(apiKey);
    openRouterCatalogCache = {
      expiresAt: Date.now() + CATALOG_TTL_MS,
      models,
    };

    return models;
  })();

  try {
    return await openRouterCatalogRequest;
  } finally {
    openRouterCatalogRequest = null;
  }
}

function unavailableExecution(
  candidate: WorkspaceRuntimeExecution,
  summary: string
): WorkspaceRuntimeExecution {
  return {
    available: false,
    mode: "assistant_only",
    provider: null,
    model: null,
    label: candidate.label,
    summary,
    pricing: null,
  };
}

export async function resolveAvailableWorkspaceRuntimeExecution(
  modelSlug: string,
  options?: { openRouterApiKey?: string }
): Promise<WorkspaceRuntimeExecution> {
  const candidate = resolveWorkspaceRuntimeExecution(modelSlug);
  if (!candidate.available || candidate.provider !== "openrouter" || !candidate.model) {
    return candidate;
  }

  try {
    const models = await loadOpenRouterModels(options?.openRouterApiKey);
    const liveModel = models.get(candidate.model);
    if (liveModel) {
      return { ...candidate, pricing: liveModel.pricing };
    }

    return unavailableExecution(
      candidate,
      "This model is tracked in the catalog but is not currently offered by the managed runtime provider. Use its verified provider path instead."
    );
  } catch {
    return unavailableExecution(
      candidate,
      "AI Market Cap could not verify this model with the managed runtime provider right now. Try again shortly; no deployment or charge was created."
    );
  }
}

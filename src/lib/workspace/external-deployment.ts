import { REPLICATE_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/replicate";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const HUGGING_FACE_API_BASE = "https://huggingface.co/api/models";
const HUGGING_FACE_INFERENCE_BASE = "https://api-inference.huggingface.co/models";

type ExternalPlatformSlug = "replicate" | "huggingface";
type ExternalProviderSlug = "replicate" | "huggingface";

export interface ExternalDeploymentTarget {
  platformSlug: ExternalPlatformSlug;
  platformName: string;
  provider: ExternalProviderSlug;
  owner: string;
  name: string;
  modelRef: string;
  webUrl: string;
}

export interface WorkspaceProvisioningOption {
  canCreate: boolean;
  deploymentKind: "managed_api" | "hosted_external" | "assistant_only";
  label: string;
  summary: string;
  target: ExternalDeploymentTarget | null;
}

export interface HostedDeploymentStatusSnapshot {
  status: "provisioning" | "ready" | "paused" | "failed";
  externalWebUrl: string | null;
  externalModelRef: string | null;
  errorMessage: string | null;
}

interface ModelProvisioningRecord {
  slug: string;
  name: string;
  provider: string;
  category: string | null;
  parameter_count: number | null;
  hf_model_id?: string | null;
}

interface ModelLookupClient {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<{ data: ModelProvisioningRecord | null; error: unknown }>;
      };
    };
  };
}

interface ReplicateModelResponse {
  owner: string;
  name: string;
  latest_version: {
    id: string;
    openapi_schema?: {
      components?: {
        schemas?: {
          Input?: {
            properties?: Record<string, unknown>;
          };
        };
      };
    };
  } | null;
}

interface ReplicateDeploymentResponse {
  owner: string;
  name: string;
  current_release?: {
    model?: string;
    version?: string;
    created_at?: string;
    configuration?: {
      hardware?: string;
      min_instances?: number;
      max_instances?: number;
    } | null;
  } | null;
}

interface ReplicateCatalogEntry {
  owner: string;
  name: string;
  url?: string | null;
}

interface WorkspaceProvisioningHintInput {
  modelSlug: string;
  modelName: string;
  provider: string;
  category: string | null;
  hfModelId?: string | null;
  runtimeExecution: {
    available: boolean;
    label: string;
    summary: string;
  };
}

interface ReplicateModelCapability {
  hasChatInput: boolean;
}

interface HuggingFaceModelCapability {
  hasHostedInference: boolean;
  task: string | null;
}

interface HuggingFaceModelResponse {
  id?: string;
  inference?: string | null;
  pipeline_tag?: string | null;
  disabled?: boolean;
  gated?: boolean | string;
}

function normalizeValue(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferReplicateProviderAliases(provider: string) {
  const normalized = normalizeValue(provider);
  if (normalized === "meta") return new Set(["meta", "meta-llama"]);
  if (normalized === "mistral-ai") return new Set(["mistralai", "mistral"]);
  if (normalized === "qwen") return new Set(["qwen", "qwenlm"]);
  if (normalized === "google") return new Set(["google", "google-deepmind", "prunaai"]);
  return new Set([normalized]);
}

function isChatDeployableCategory(category: string | null) {
  return category === "llm" || category === "multimodal" || category === "code";
}

function scoreReplicateCandidate(
  model: ModelProvisioningRecord,
  candidate: { owner: string; name: string }
) {
  const modelSlug = normalizeValue(model.slug);
  const modelName = normalizeValue(model.name);
  const hfModelId = normalizeValue(model.hf_model_id);
  const providerAliases = inferReplicateProviderAliases(model.provider);
  const candidateName = normalizeValue(candidate.name);
  const candidateOwner = normalizeValue(candidate.owner);
  if (!providerAliases.has(candidateOwner)) return -1;

  let score = 0;
  if (modelSlug.includes(candidateName)) score += 5;
  if (modelName.includes(candidateName)) score += 4;
  if (hfModelId.length > 0 && hfModelId.endsWith(candidateName)) score += 4;

  const candidateTokens = candidateName.split("-").filter(Boolean);
  const matchedTokens = candidateTokens.filter(
    (token) =>
      token.length > 2 &&
      (modelSlug.includes(token) || modelName.includes(token) || hfModelId.includes(token))
  ).length;
  score += matchedTokens;

  if (/llama|mistral|mixtral|gemma|qwen|flux|sdxl|stable-diffusion|whisper|musicgen/i.test(candidateName)) {
    score += 1;
  }

  return score;
}

function toReplicateTarget(candidate: { owner: string; name: string }): ExternalDeploymentTarget {
  return {
    platformSlug: "replicate",
    platformName: "Replicate",
    provider: "replicate",
    owner: candidate.owner,
    name: candidate.name,
    modelRef: `${candidate.owner}/${candidate.name}`,
    webUrl: `https://replicate.com/${candidate.owner}/${candidate.name}`,
  };
}

function buildReplicateDeploymentWebUrl(owner: string, name: string) {
  return `https://replicate.com/${owner}/${name}`;
}

function buildHuggingFaceModelWebUrl(modelRef: string) {
  return `https://huggingface.co/${modelRef}`;
}

function splitModelRef(modelRef: string) {
  const [owner, ...rest] = modelRef.split("/");
  if (!owner || rest.length === 0) return null;
  return {
    owner,
    name: rest.join("/"),
  };
}

let replicateCatalogCache:
  | {
      expiresAt: number;
      items: ReplicateCatalogEntry[];
    }
  | null = null;

const replicateCapabilityCache = new Map<string, ReplicateModelCapability>();
const huggingFaceCapabilityCache = new Map<string, HuggingFaceModelCapability>();

async function loadReplicateCatalog(): Promise<ReplicateCatalogEntry[]> {
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  if (!token) return [];

  const now = Date.now();
  if (replicateCatalogCache && replicateCatalogCache.expiresAt > now) {
    return replicateCatalogCache.items;
  }

  const items: ReplicateCatalogEntry[] = [];
  let nextUrl: string | null = `${REPLICATE_API_BASE}/models?limit=100`;

  for (let page = 0; page < 8 && nextUrl; page += 1) {
    let response: Response;
    try {
      response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 3600 },
      });
    } catch {
      break;
    }

    const raw = (await response.json().catch(() => null)) as
      | { results?: ReplicateCatalogEntry[]; next?: string | null }
      | null;
    if (!response.ok || !raw?.results) break;
    items.push(
      ...raw.results.map((entry) => ({
        owner: entry.owner,
        name: entry.name,
        url: entry.url ?? null,
      }))
    );
    nextUrl = raw.next ?? null;
  }

  replicateCatalogCache = {
    expiresAt: now + 60 * 60 * 1000,
    items,
  };

  return items;
}

function getReplicatePromptField(properties: Record<string, unknown>) {
  if ("prompt" in properties) return "prompt";
  if ("input" in properties) return "input";
  if ("text" in properties) return "text";
  return null;
}

async function loadReplicateModelCapability(input: {
  owner: string;
  name: string;
}): Promise<ReplicateModelCapability> {
  const cacheKey = `${input.owner}/${input.name}`;
  const cached = replicateCapabilityCache.get(cacheKey);
  if (cached) return cached;

  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  if (!token) {
    return { hasChatInput: false };
  }

  try {
    const response = await fetch(
      `${REPLICATE_API_BASE}/models/${input.owner}/${input.name}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 3600 },
      }
    );
    const raw = (await response.json().catch(() => null)) as ReplicateModelResponse | null;
    const properties =
      raw?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties ?? {};
    const capability = {
      hasChatInput: Boolean(getReplicatePromptField(properties)),
    };
    replicateCapabilityCache.set(cacheKey, capability);
    return capability;
  } catch {
    return { hasChatInput: false };
  }
}

async function resolveReplicateTarget(
  model: ModelProvisioningRecord
): Promise<ExternalDeploymentTarget | null> {
  if (!isChatDeployableCategory(model.category)) {
    return null;
  }

  let bestStatic:
    | {
        owner: string;
        name: string;
        score: number;
      }
    | null = null;
  for (const candidate of REPLICATE_KNOWN_MODELS) {
    if (candidate.category !== "llm") continue;
    const score = scoreReplicateCandidate(model, candidate);
    if (score > (bestStatic?.score ?? -1)) {
      bestStatic = { owner: candidate.owner, name: candidate.name, score };
    }
  }

  if (bestStatic && bestStatic.score >= 5) {
    const capability = await loadReplicateModelCapability(bestStatic);
    if (capability.hasChatInput) {
      return toReplicateTarget(bestStatic);
    }
  }

  const catalog = await loadReplicateCatalog();
  const rankedCatalog = catalog
    .map((candidate) => ({
      owner: candidate.owner,
      name: candidate.name,
      score: scoreReplicateCandidate(model, candidate),
    }))
    .filter((candidate) => candidate.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const candidate of rankedCatalog) {
    const capability = await loadReplicateModelCapability(candidate);
    if (capability.hasChatInput) {
      return toReplicateTarget(candidate);
    }
  }

  return null;
}

function isHuggingFaceHostedEligible(model: ModelProvisioningRecord) {
  return isChatDeployableCategory(model.category) && Boolean(model.hf_model_id);
}

async function loadHuggingFaceModelCapability(
  modelRef: string
): Promise<HuggingFaceModelCapability> {
  const cached = huggingFaceCapabilityCache.get(modelRef);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${HUGGING_FACE_API_BASE}/${encodeURIComponent(modelRef)}?expand[]=inference&expand[]=pipeline_tag&expand[]=disabled&expand[]=gated`,
      {
        next: { revalidate: 3600 },
      }
    );
    const raw = (await response.json().catch(() => null)) as HuggingFaceModelResponse | null;
    const task = typeof raw?.pipeline_tag === "string" ? raw.pipeline_tag : null;
    const capability = {
      hasHostedInference:
        Boolean(raw) &&
        !raw?.disabled &&
        (raw?.inference === "warm" || raw?.inference === "hot") &&
        (task === "text-generation" ||
          task === "text2text-generation" ||
          task === "conversational"),
      task,
    };
    huggingFaceCapabilityCache.set(modelRef, capability);
    return capability;
  } catch {
    return { hasHostedInference: false, task: null };
  }
}

async function resolveHuggingFaceTarget(
  model: ModelProvisioningRecord
): Promise<ExternalDeploymentTarget | null> {
  if (
    !isHuggingFaceHostedEligible(model) ||
    !getOptionalEnv("HUGGINGFACE_API_TOKEN", "HF_TOKEN")
  ) {
    return null;
  }

  const modelRef = model.hf_model_id ?? "";
  const parts = splitModelRef(modelRef);
  if (!parts) return null;

  const capability = await loadHuggingFaceModelCapability(modelRef);
  if (!capability.hasHostedInference) {
    return null;
  }

  return {
    platformSlug: "huggingface",
    platformName: "Hugging Face",
    provider: "huggingface",
    owner: parts.owner,
    name: parts.name,
    modelRef,
    webUrl: buildHuggingFaceModelWebUrl(modelRef),
  };
}

export function resolveWorkspaceProvisioningHint(
  input: WorkspaceProvisioningHintInput
): WorkspaceProvisioningOption {
  if (input.runtimeExecution.available) {
    return {
      canCreate: true,
      deploymentKind: "managed_api",
      label: input.runtimeExecution.label,
      summary: input.runtimeExecution.summary,
      target: null,
    };
  }

  if (!isChatDeployableCategory(input.category)) {
    return {
      canCreate: false,
      deploymentKind: "assistant_only",
      label: "Workspace assistant only",
      summary:
        "A one-click hosted deployment is not available for this model yet, so keep using the verified provider path for now.",
      target: null,
    };
  }

  const bestStatic = REPLICATE_KNOWN_MODELS.filter((candidate) => candidate.category === "llm")
    .map((candidate) => ({
      owner: candidate.owner,
      name: candidate.name,
      score: scoreReplicateCandidate(
        {
          slug: input.modelSlug,
          name: input.modelName,
          provider: input.provider,
          category: input.category,
          parameter_count: null,
          hf_model_id: input.hfModelId ?? null,
        },
        candidate
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestStatic && bestStatic.score >= 5) {
    return {
      canCreate: true,
      deploymentKind: "hosted_external",
      label: "Replicate hosted deployment",
      summary:
        "AI Market Cap can create and manage a hosted deployment for this model, then keep chat, API access, and usage tracking on-site.",
      target: toReplicateTarget(bestStatic),
    };
  }

  return {
    canCreate: false,
    deploymentKind: "assistant_only",
    label: "Workspace assistant only",
    summary:
      "A one-click hosted deployment is not available for this model yet, so keep using the verified provider path for now.",
    target: null,
  };
}

export function clearReplicateCatalogCacheForTests() {
  replicateCatalogCache = null;
  replicateCapabilityCache.clear();
  huggingFaceCapabilityCache.clear();
}

export async function resolveWorkspaceProvisioningOption(input: {
  supabase: unknown;
  modelSlug: string;
  runtimeExecution: {
    available: boolean;
    label: string;
    summary: string;
  };
}): Promise<WorkspaceProvisioningOption> {
  const lookupClient = input.supabase as ModelLookupClient;

  const { data: model } = await lookupClient
    .from("models")
    .select("slug, name, provider, category, parameter_count, hf_model_id")
    .eq("slug", input.modelSlug)
    .single();

  if (!model) {
    return resolveWorkspaceProvisioningHint({
      modelSlug: input.modelSlug,
      modelName: input.modelSlug,
      provider: "",
      category: null,
      runtimeExecution: input.runtimeExecution,
    });
  }

  const staticHint = resolveWorkspaceProvisioningHint({
    modelSlug: model.slug,
    modelName: model.name,
    provider: model.provider,
    category: model.category,
    hfModelId: model.hf_model_id,
    runtimeExecution: input.runtimeExecution,
  });
  if (staticHint.canCreate && staticHint.deploymentKind === "managed_api") {
    return staticHint;
  }

  const replicateTarget = getOptionalEnv("REPLICATE_API_TOKEN")
    ? await resolveReplicateTarget(model)
    : null;
  if (replicateTarget) {
    return {
      canCreate: true,
      deploymentKind: "hosted_external",
      label: "Replicate hosted deployment",
      summary:
        "AI Market Cap can create and manage a hosted Replicate deployment for this model, then keep chat, API access, and usage tracking on-site.",
      target: replicateTarget,
    };
  }

  const huggingFaceTarget = await resolveHuggingFaceTarget(model);
  if (huggingFaceTarget) {
    return {
      canCreate: true,
      deploymentKind: "hosted_external",
      label: "Hugging Face hosted inference",
      summary:
        "AI Market Cap can connect this model to Hugging Face hosted inference, then keep chat, API access, and usage tracking on-site.",
      target: huggingFaceTarget,
    };
  }

  return staticHint;
}

function buildReplicateHeaders() {
  return {
    Authorization: `Bearer ${getOptionalEnv("REPLICATE_API_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

async function fetchReplicateDeployment(input: { owner: string; name: string }) {
  const response = await fetch(
    `${REPLICATE_API_BASE}/deployments/${input.owner}/${input.name}`,
    {
      headers: {
        Authorization: `Bearer ${getOptionalEnv("REPLICATE_API_TOKEN")}`,
      },
      cache: "no-store",
    }
  );
  const raw = (await response.json().catch(() => null)) as ReplicateDeploymentResponse | null;
  return { response, raw };
}

export async function refreshHostedDeploymentStatus(input: {
  provider: string | null;
  owner: string | null;
  name: string | null;
}): Promise<HostedDeploymentStatusSnapshot | null> {
  if (input.provider === "huggingface" && input.owner && input.name) {
    const modelRef = `${input.owner}/${input.name}`;
    const capability = await loadHuggingFaceModelCapability(modelRef);
    return {
      status: capability.hasHostedInference ? "ready" : "failed",
      externalWebUrl: buildHuggingFaceModelWebUrl(modelRef),
      externalModelRef: capability.hasHostedInference ? modelRef : null,
      errorMessage: capability.hasHostedInference
        ? null
        : "Hugging Face hosted inference is no longer available for this model.",
    };
  }

  if (input.provider !== "replicate" || !input.owner || !input.name) {
    return null;
  }

  const { response, raw } = await fetchReplicateDeployment({
    owner: input.owner,
    name: input.name,
  });

  if (response.status === 404) {
    return {
      status: "failed",
      externalWebUrl: buildReplicateDeploymentWebUrl(input.owner, input.name),
      externalModelRef: null,
      errorMessage: "The hosted Replicate deployment no longer exists.",
    };
  }

  if (!response.ok || !raw) {
    throw new Error("Replicate deployment status lookup failed");
  }

  const minInstances = raw.current_release?.configuration?.min_instances ?? null;
  const maxInstances = raw.current_release?.configuration?.max_instances ?? null;
  const isPaused = minInstances === 0 && maxInstances === 0;
  const isReady = Boolean(raw.current_release?.model && raw.current_release?.version);

  return {
    status: isPaused ? "paused" : isReady ? "ready" : "provisioning",
    externalWebUrl: buildReplicateDeploymentWebUrl(raw.owner, raw.name),
    externalModelRef: raw.current_release?.model ?? null,
    errorMessage: null,
  };
}

export async function updateHostedDeploymentScale(input: {
  provider: string | null;
  owner: string | null;
  name: string | null;
  minInstances: number;
  maxInstances: number;
}) {
  if (input.provider === "huggingface" && input.owner && input.name) {
    const modelRef = `${input.owner}/${input.name}`;
    return {
      externalWebUrl: buildHuggingFaceModelWebUrl(modelRef),
      externalModelRef: modelRef,
    };
  }

  if (input.provider !== "replicate" || !input.owner || !input.name) {
    throw new Error("Hosted deployment target is incomplete");
  }

  const response = await fetch(
    `${REPLICATE_API_BASE}/deployments/${input.owner}/${input.name}`,
    {
      method: "PATCH",
      headers: buildReplicateHeaders(),
      body: JSON.stringify({
        min_instances: input.minInstances,
        max_instances: input.maxInstances,
      }),
    }
  );
  const raw = (await response.json().catch(() => null)) as ReplicateDeploymentResponse | null;

  if (!response.ok || !raw) {
    const message =
      raw && typeof raw === "object" && "detail" in raw
        ? String((raw as { detail?: unknown }).detail)
        : "Replicate deployment scaling update failed";
    throw new Error(message);
  }

  return {
    externalWebUrl: buildReplicateDeploymentWebUrl(raw.owner, raw.name),
    externalModelRef: raw.current_release?.model ?? null,
  };
}

function estimateReplicateHardware(input: { parameterCount: number | null; category: string | null }) {
  if (input.category !== "llm") return "gpu-t4";
  if ((input.parameterCount ?? 0) >= 20_000_000_000) return "gpu-a40-large";
  return "gpu-t4";
}

function buildDeploymentName(modelSlug: string) {
  const normalized = normalizeValue(modelSlug).slice(0, 44) || "aimarketcap-model";
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `aimc-${normalized}-${suffix}`;
}

export async function provisionReplicateDeployment(input: {
  target: ExternalDeploymentTarget;
  modelSlug: string;
  category: string | null;
  parameterCount: number | null;
}) {
  const accountResponse = await fetch(`${REPLICATE_API_BASE}/account`, {
    headers: {
      Authorization: `Bearer ${getOptionalEnv("REPLICATE_API_TOKEN")}`,
    },
  });
  const accountRaw = await accountResponse.json().catch(() => null);
  if (!accountResponse.ok || !accountRaw?.username) {
    throw new Error("Replicate account lookup failed");
  }

  const modelResponse = await fetch(
    `${REPLICATE_API_BASE}/models/${input.target.owner}/${input.target.name}`,
    {
      headers: {
        Authorization: `Bearer ${getOptionalEnv("REPLICATE_API_TOKEN")}`,
      },
    }
  );
  const modelRaw = (await modelResponse.json().catch(() => null)) as ReplicateModelResponse | null;
  if (!modelResponse.ok || !modelRaw?.latest_version?.id) {
    throw new Error("Replicate model details could not be loaded for deployment");
  }

  const deploymentName = buildDeploymentName(input.modelSlug);
  const createResponse = await fetch(`${REPLICATE_API_BASE}/deployments`, {
    method: "POST",
    headers: buildReplicateHeaders(),
    body: JSON.stringify({
      name: deploymentName,
      model: input.target.modelRef,
      version: modelRaw.latest_version.id,
      hardware: estimateReplicateHardware({
        parameterCount: input.parameterCount,
        category: input.category,
      }),
      min_instances: 0,
      max_instances: 1,
    }),
  });
  const createRaw = (await createResponse.json().catch(() => null)) as ReplicateDeploymentResponse | null;
  if (!createResponse.ok || !createRaw?.owner || !createRaw?.name) {
    const message =
      createRaw && typeof createRaw === "object" && "detail" in createRaw
        ? String((createRaw as { detail?: unknown }).detail)
        : "Replicate deployment creation failed";
    throw new Error(message);
  }

  return {
    external_platform_slug: "replicate" as const,
    external_provider: "replicate" as const,
    external_owner: createRaw.owner,
    external_name: createRaw.name,
    external_model_ref: createRaw.current_release?.model ?? input.target.modelRef,
    external_web_url: buildReplicateDeploymentWebUrl(createRaw.owner, createRaw.name),
  };
}

export async function provisionHuggingFaceDeployment(input: {
  target: ExternalDeploymentTarget;
}) {
  if (input.target.provider !== "huggingface") {
    throw new Error("Hosted deployment target is incomplete");
  }

  return {
    external_platform_slug: "huggingface" as const,
    external_provider: "huggingface" as const,
    external_owner: input.target.owner,
    external_name: input.target.name,
    external_model_ref: input.target.modelRef,
    external_web_url: input.target.webUrl,
  };
}

export async function runReplicateDeployment(input: {
  owner: string;
  name: string;
  message: string;
  system?: string;
  modelRef: string;
}) {
  const modelRefParts = input.modelRef.split("/");
  if (modelRefParts.length !== 2) {
    throw new Error("Replicate deployment is missing a valid model reference");
  }

  const modelResponse = await fetch(
    `${REPLICATE_API_BASE}/models/${modelRefParts[0]}/${modelRefParts[1]}`,
    {
      headers: {
        Authorization: `Bearer ${getOptionalEnv("REPLICATE_API_TOKEN")}`,
      },
    }
  );
  const modelRaw = (await modelResponse.json().catch(() => null)) as ReplicateModelResponse | null;
  if (!modelResponse.ok || !modelRaw) {
    throw new Error("Replicate model schema lookup failed");
  }

  const properties =
    modelRaw.latest_version?.openapi_schema?.components?.schemas?.Input?.properties ?? {};
  const propertyKeys = Object.keys(properties);
  const promptField = getReplicatePromptField(properties);

  if (!promptField) {
    throw new Error("This hosted deployment does not expose a chat-style text input yet");
  }

  const requestInput: Record<string, unknown> = {
    [promptField]: input.message,
  };
  if (input.system && propertyKeys.includes("system_prompt")) {
    requestInput.system_prompt = input.system;
  }
  if (propertyKeys.includes("max_tokens")) {
    requestInput.max_tokens = 1024;
  }

  const response = await fetch(
    `${REPLICATE_API_BASE}/deployments/${input.owner}/${input.name}/predictions`,
    {
      method: "POST",
      headers: {
        ...buildReplicateHeaders(),
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: requestInput,
      }),
    }
  );

  const raw = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      raw && typeof raw === "object" && "detail" in raw
        ? String((raw as { detail?: unknown }).detail)
        : `Replicate returned HTTP ${response.status}`;
    throw new Error(message);
  }

  const output = raw && typeof raw === "object" ? (raw as { output?: unknown }).output : null;
  const content = Array.isArray(output)
    ? output.map((item) => (typeof item === "string" ? item : "")).join("\n").trim()
    : typeof output === "string"
      ? output
      : raw && typeof raw === "object" && typeof (raw as { logs?: unknown }).logs === "string"
        ? (raw as { logs: string }).logs
        : "";

  if (!content) {
    throw new Error("Replicate deployment returned an empty response");
  }

  return {
    content,
    provider: "replicate" as const,
    model: input.modelRef,
    usage: null,
    raw,
  };
}

export async function runHuggingFaceDeployment(input: {
  modelRef: string;
  message: string;
  system?: string;
}) {
  const token = getOptionalEnv("HUGGINGFACE_API_TOKEN", "HF_TOKEN");
  if (!token) {
    throw new Error("Hugging Face hosted inference is not configured");
  }

  const capability = await loadHuggingFaceModelCapability(input.modelRef);
  if (!capability.hasHostedInference) {
    throw new Error("This Hugging Face model is not available for hosted inference");
  }

  const prompt = input.system
    ? `System: ${input.system}\n\nUser: ${input.message}\nAssistant:`
    : input.message;
  const response = await fetch(
    `${HUGGING_FACE_INFERENCE_BASE}/${encodeURIComponent(input.modelRef)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          return_full_text: false,
          temperature: 0.2,
        },
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      }),
    }
  );

  const raw = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      raw && typeof raw === "object" && "error" in raw
        ? String((raw as { error?: unknown }).error)
        : `Hugging Face returned HTTP ${response.status}`;
    throw new Error(message);
  }

  const content = Array.isArray(raw)
    ? raw
        .map((item) =>
          item && typeof item === "object" && "generated_text" in item
            ? String((item as { generated_text?: unknown }).generated_text ?? "")
            : ""
        )
        .join("\n")
        .trim()
    : raw && typeof raw === "object" && "generated_text" in raw
      ? String((raw as { generated_text?: unknown }).generated_text ?? "").trim()
      : typeof raw === "string"
        ? raw.trim()
        : "";

  if (!content) {
    throw new Error("Hugging Face hosted inference returned an empty response");
  }

  return {
    content,
    provider: "huggingface" as const,
    model: input.modelRef,
    usage: null,
    raw,
  };
}
function getOptionalEnv(...names: string[]) {
  for (const name of names) {
    if (process.env[name]) return process.env[name] as string;
  }
  return "";
}

import "server-only";

import type { ProviderConnectionProvider } from "@/types/database";
import { getRunpodAccount } from "@/lib/runpod/client";

const VALIDATION_TIMEOUT_MS = 8_000;

export const PROVIDER_CONNECTIONS = {
  runpod: {
    name: "Runpod",
    capabilities: ["gpu_pods"],
  },
  openrouter: {
    name: "OpenRouter",
    capabilities: ["routed_inference"],
  },
  replicate: {
    name: "Replicate",
    capabilities: ["hosted_inference", "dedicated_deployments"],
  },
  huggingface: {
    name: "Hugging Face",
    capabilities: ["routed_inference", "gated_model_access"],
  },
} as const satisfies Record<
  ProviderConnectionProvider,
  { name: string; capabilities: readonly string[] }
>;

export interface ProviderCredentialValidation {
  externalAccountId: string | null;
  externalAccountName: string | null;
  capabilities: string[];
}

function providerValidationError(provider: ProviderConnectionProvider, status?: number) {
  const suffix = status ? ` (HTTP ${status})` : "";
  return new Error(`${PROVIDER_CONNECTIONS[provider].name} rejected this credential${suffix}`);
}

async function validateOpenRouter(secret: string): Promise<ProviderCredentialValidation> {
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => null)) as
    | { data?: { creator_user_id?: unknown; label?: unknown; is_management_key?: unknown } }
    | null;
  if (!response.ok || !body?.data) throw providerValidationError("openrouter", response.status);
  if (body.data.is_management_key === true) {
    throw new Error(
      "OpenRouter management keys are not accepted. Create a dedicated inference key instead."
    );
  }

  return {
    externalAccountId:
      typeof body.data.creator_user_id === "string" ? body.data.creator_user_id : null,
    externalAccountName:
      typeof body.data.label === "string" ? body.data.label : "OpenRouter API key",
    capabilities: ["routed_inference"],
  };
}

async function validateReplicate(secret: string): Promise<ProviderCredentialValidation> {
  const response = await fetch("https://api.replicate.com/v1/account", {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => null)) as
    | { username?: unknown; name?: unknown }
    | null;
  if (!response.ok || typeof body?.username !== "string") {
    throw providerValidationError("replicate", response.status);
  }

  return {
    externalAccountId: body.username,
    externalAccountName:
      typeof body.name === "string" && body.name ? body.name : body.username,
    capabilities: ["hosted_inference", "dedicated_deployments"],
  };
}

async function validateHuggingFace(secret: string): Promise<ProviderCredentialValidation> {
  const response = await fetch("https://huggingface.co/api/whoami-v2", {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => null)) as
    | { name?: unknown; fullname?: unknown }
    | null;
  if (!response.ok || typeof body?.name !== "string") {
    throw providerValidationError("huggingface", response.status);
  }

  return {
    externalAccountId: body.name,
    externalAccountName:
      typeof body.fullname === "string" && body.fullname ? body.fullname : body.name,
    capabilities: ["routed_inference", "gated_model_access"],
  };
}

export async function validateProviderCredential(
  provider: ProviderConnectionProvider,
  secret: string
) {
  if (provider === "runpod") {
    const id = await getRunpodAccount(secret);
    return { externalAccountId: id, externalAccountName: "Runpod account", capabilities: ["gpu_pods"] };
  }
  if (provider === "openrouter") return validateOpenRouter(secret);
  if (provider === "replicate") return validateReplicate(secret);
  return validateHuggingFace(secret);
}

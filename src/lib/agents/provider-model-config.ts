import { createTaggedLogger } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AGENT_PROVIDER_ORDER,
  DEFAULT_AGENT_PROVIDER_MODELS,
  type AgentProviderName,
} from "./provider-model-constants";

const log = createTaggedLogger("agents/provider-model-config");

const CACHE_TTL_MS = 60_000;

let cachedOverrides: Partial<Record<AgentProviderName, string>> | null = null;
let cachedAt = 0;

export function clearAgentProviderModelOverrideCache() {
  cachedOverrides = null;
  cachedAt = 0;
}

export async function getAgentProviderModelOverrides(
  forceRefresh = false
): Promise<Partial<Record<AgentProviderName, string>>> {
  if (
    !forceRefresh &&
    cachedOverrides &&
    Date.now() - cachedAt < CACHE_TTL_MS
  ) {
    return cachedOverrides;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("agent_provider_settings")
      .select("provider, model_id");

    if (error) {
      throw error;
    }

    const overrides: Partial<Record<AgentProviderName, string>> = {};
    for (const row of data ?? []) {
      if (
        typeof row.provider === "string" &&
        AGENT_PROVIDER_ORDER.includes(row.provider as AgentProviderName) &&
        typeof row.model_id === "string" &&
        row.model_id.trim().length > 0
      ) {
        overrides[row.provider as AgentProviderName] = row.model_id.trim();
      }
    }

    cachedOverrides = overrides;
    cachedAt = Date.now();
    return overrides;
  } catch (error) {
    void log.warn("Failed to load agent provider model overrides", {
      error: error instanceof Error ? error.message : String(error),
    });
    return cachedOverrides ?? {};
  }
}

export async function getEffectiveAgentProviderModels(
  forceRefresh = false
): Promise<Record<AgentProviderName, string>> {
  const overrides = await getAgentProviderModelOverrides(forceRefresh);
  return {
    ...DEFAULT_AGENT_PROVIDER_MODELS,
    ...overrides,
  };
}

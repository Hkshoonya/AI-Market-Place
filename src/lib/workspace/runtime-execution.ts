import type { AgentProviderName } from "@/lib/agents/provider-model-constants";
import { ANTHROPIC_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/anthropic";
import { GOOGLE_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/google";
import { MINIMAX_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/minimax";
import { OPENAI_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/openai";
import { XAI_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/xai";

export interface WorkspaceRuntimeExecution {
  available: boolean;
  mode: "native_model" | "assistant_only";
  provider: AgentProviderName | null;
  model: string | null;
  label: string;
  summary: string;
}

interface RuntimeCatalogRoute {
  provider: AgentProviderName;
  providerPrefixes: string[];
  modelPrefix: string | null;
  keys: string[];
  label: string;
}

const CATALOG_ROUTES: RuntimeCatalogRoute[] = [
  {
    provider: "openrouter",
    providerPrefixes: ["openai"],
    modelPrefix: "openai",
    keys: Object.keys(OPENAI_KNOWN_MODELS),
    label: "OpenRouter-backed runtime",
  },
  {
    provider: "openrouter",
    providerPrefixes: ["anthropic", "claude"],
    modelPrefix: "anthropic",
    keys: Object.keys(ANTHROPIC_KNOWN_MODELS),
    label: "OpenRouter-backed runtime",
  },
  {
    provider: "openrouter",
    providerPrefixes: ["google", "gemini"],
    modelPrefix: "google",
    keys: Object.keys(GOOGLE_KNOWN_MODELS).filter((key) => key.startsWith("gemini-")),
    label: "OpenRouter-backed runtime",
  },
  {
    provider: "openrouter",
    providerPrefixes: ["xai", "x-ai", "grok"],
    modelPrefix: "x-ai",
    keys: Object.keys(XAI_KNOWN_MODELS),
    label: "OpenRouter-backed runtime",
  },
  {
    provider: "minimax",
    providerPrefixes: ["minimax"],
    modelPrefix: null,
    keys: Object.keys(MINIMAX_KNOWN_MODELS),
    label: "MiniMax direct runtime",
  },
];

function normalizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function findMatchingModelKey(modelSlug: string, route: RuntimeCatalogRoute): string | null {
  const normalizedSlug = normalizeSegment(modelSlug);
  const matchingPrefix = route.providerPrefixes.find((prefix) => {
    const normalizedPrefix = normalizeSegment(prefix);
    return normalizedSlug === normalizedPrefix || normalizedSlug.startsWith(`${normalizedPrefix}-`);
  });

  if (!matchingPrefix) {
    return null;
  }

  const normalizedPrefix = normalizeSegment(matchingPrefix);
  const slugRemainder =
    normalizedSlug === normalizedPrefix
      ? ""
      : normalizedSlug.slice(normalizedPrefix.length + 1);

  if (!slugRemainder) {
    return null;
  }

  for (const key of route.keys) {
    if (normalizeSegment(key) === slugRemainder) {
      return key;
    }
  }

  return null;
}

export function resolveWorkspaceRuntimeExecution(modelSlug: string): WorkspaceRuntimeExecution {
  for (const route of CATALOG_ROUTES) {
    const key = findMatchingModelKey(modelSlug, route);
    if (!key) continue;

    return {
      available: true,
      mode: "native_model",
      provider: route.provider,
      model: route.modelPrefix ? `${route.modelPrefix}/${key}` : key,
      label: route.label,
      summary:
        route.provider === "minimax"
          ? "This model can run through the in-site runtime using the configured MiniMax API."
          : "This model can run through the in-site runtime using a configured OpenRouter route.",
    };
  }

  return {
    available: false,
    mode: "assistant_only",
    provider: null,
    model: null,
    label: "Workspace assistant only",
    summary:
      "A direct in-site runtime has not been mapped for this model yet, so the saved workspace keeps the assistant/setup path only for now.",
  };
}

import type { AgentProviderName } from "./provider-model-constants";

export interface AgentTaskModelMetadata {
  provider: AgentProviderName | null;
  model: string | null;
}

function isProviderName(value: unknown): value is AgentProviderName {
  return (
    value === "openrouter" ||
    value === "deepseek" ||
    value === "minimax" ||
    value === "anthropic"
  );
}

function inspectValue(value: unknown): AgentTaskModelMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = inspectValue(item);
      if (match?.provider || match?.model) {
        return match;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;

  const directProvider = record.llmProvider ?? record.provider;
  const directModel = record.llmModel ?? record.model;
  if (isProviderName(directProvider) || typeof directModel === "string") {
    return {
      provider: isProviderName(directProvider) ? directProvider : null,
      model: typeof directModel === "string" ? directModel : null,
    };
  }

  for (const nested of Object.values(record)) {
    const match = inspectValue(nested);
    if (match?.provider || match?.model) {
      return match;
    }
  }

  return null;
}

export function extractAgentTaskModelMetadata(input: unknown): AgentTaskModelMetadata {
  return inspectValue(input) ?? { provider: null, model: null };
}

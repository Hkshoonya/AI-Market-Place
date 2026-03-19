import type { MessageParam as AnthropicMessageParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { getEffectiveAgentProviderModels } from "./provider-model-config";
import {
  DEFAULT_AGENT_PROVIDER_MODELS,
  type AgentProviderName,
} from "./provider-model-constants";

export interface AgentModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AgentModelRequest {
  system?: string;
  prompt?: string;
  messages?: AgentModelMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  preferredProviders?: AgentProviderName[];
  providerModels?: Partial<Record<AgentProviderName, string>>;
}

export interface AgentModelResponse {
  content: string;
  provider: AgentProviderName;
  model: string;
  usage: AgentModelUsage | null;
  raw: unknown;
}

interface ProviderCandidate {
  name: AgentProviderName;
  apiKey: string;
}

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const DEEPSEEK_API_BASE = "https://api.deepseek.com";
const MINIMAX_API_BASE = "https://api.minimax.io/v1/openai";

function getOptionalEnv(name: string): string {
  return process.env[name] ?? "";
}

function getConfiguredProviders(): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  if (getOptionalEnv("OPENROUTER_API_KEY")) {
    candidates.push({ name: "openrouter", apiKey: getOptionalEnv("OPENROUTER_API_KEY") });
  }
  if (getOptionalEnv("DEEPSEEK_API_KEY")) {
    candidates.push({ name: "deepseek", apiKey: getOptionalEnv("DEEPSEEK_API_KEY") });
  }
  if (getOptionalEnv("MINIMAX_API_KEY")) {
    candidates.push({ name: "minimax", apiKey: getOptionalEnv("MINIMAX_API_KEY") });
  }
  if (getOptionalEnv("ANTHROPIC_API_KEY")) {
    candidates.push({ name: "anthropic", apiKey: getOptionalEnv("ANTHROPIC_API_KEY") });
  }

  return candidates;
}

function resolveCandidates(
  preferredProviders?: AgentProviderName[]
): ProviderCandidate[] {
  const configured = getConfiguredProviders();
  if (!preferredProviders || preferredProviders.length === 0) {
    return configured;
  }

  const configuredMap = new Map(configured.map((candidate) => [candidate.name, candidate]));
  return preferredProviders
    .map((provider) => configuredMap.get(provider))
    .filter((candidate): candidate is ProviderCandidate => Boolean(candidate));
}

function buildMessages(request: AgentModelRequest): AgentModelMessage[] {
  if (request.messages && request.messages.length > 0) {
    return request.messages;
  }

  const messages: AgentModelMessage[] = [];
  if (request.system) {
    messages.push({ role: "system", content: request.system });
  }
  if (request.prompt) {
    messages.push({ role: "user", content: request.prompt });
  }
  return messages;
}

async function resolveModel(
  provider: AgentProviderName,
  request: AgentModelRequest
): Promise<string> {
  if (request.providerModels?.[provider]) {
    return request.providerModels[provider] as string;
  }

  const effectiveModels = await getEffectiveAgentProviderModels();
  return effectiveModels[provider] ?? DEFAULT_AGENT_PROVIDER_MODELS[provider];
}

function normalizeOpenAiUsage(usage: Record<string, unknown> | null | undefined): AgentModelUsage | null {
  if (!usage) return null;

  const input = usage.prompt_tokens;
  const output = usage.completion_tokens;
  const total = usage.total_tokens;

  return {
    inputTokens: typeof input === "number" ? input : null,
    outputTokens: typeof output === "number" ? output : null,
    totalTokens: typeof total === "number" ? total : null,
  };
}

function extractTextContent(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }

  if (
    message &&
    typeof message === "object" &&
    "content" in message &&
    typeof (message as { content?: unknown }).content === "string"
  ) {
    return (message as { content: string }).content;
  }

  if (Array.isArray(message)) {
    return message
      .map((chunk) => {
        if (
          chunk &&
          typeof chunk === "object" &&
          "text" in chunk &&
          typeof (chunk as { text?: unknown }).text === "string"
        ) {
          return (chunk as { text: string }).text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function callOpenAiCompatibleProvider(
  provider: Exclude<AgentProviderName, "anthropic">,
  apiKey: string,
  request: AgentModelRequest
): Promise<AgentModelResponse> {
  const model = await resolveModel(provider, request);
  const messages = buildMessages(request);

  const baseUrl =
    provider === "openrouter"
      ? OPENROUTER_API_BASE
      : provider === "deepseek"
        ? DEEPSEEK_API_BASE
        : MINIMAX_API_BASE;

  const headers = new Headers({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  });

  if (provider === "openrouter") {
    headers.set(
      "HTTP-Referer",
      getOptionalEnv("NEXT_PUBLIC_SITE_URL") || "https://aimarketcap.tech"
    );
    headers.set("X-Title", "AI Market Cap");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1024,
      ...(request.responseFormat === "json"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  const raw = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      raw &&
      typeof raw === "object" &&
      "error" in raw &&
      raw.error &&
      typeof raw.error === "object" &&
      "message" in raw.error &&
      typeof (raw.error as { message?: unknown }).message === "string"
        ? (raw.error as { message: string }).message
        : `${provider} returned HTTP ${response.status}`;

    throw new Error(message);
  }

  const firstChoice =
    raw &&
    typeof raw === "object" &&
    "choices" in raw &&
    Array.isArray((raw as { choices?: unknown[] }).choices)
      ? (raw as { choices: Array<{ message?: unknown }> }).choices[0]
      : null;

  const content = extractTextContent(firstChoice?.message ?? "");

  if (!content) {
    throw new Error(`${provider} returned an empty completion`);
  }

  return {
    content,
    provider,
    model:
      raw &&
      typeof raw === "object" &&
      "model" in raw &&
      typeof (raw as { model?: unknown }).model === "string"
        ? (raw as { model: string }).model
        : model,
    usage:
      raw && typeof raw === "object" && "usage" in raw
        ? normalizeOpenAiUsage((raw as { usage?: Record<string, unknown> }).usage)
        : null,
    raw,
  };
}

async function callAnthropicProvider(
  apiKey: string,
  request: AgentModelRequest
): Promise<AgentModelResponse> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const client = new Anthropic({ apiKey });
  const model = await resolveModel("anthropic", request);
  const messages = buildMessages(request);
  const systemMessage = messages.find((message) => message.role === "system")?.content;
  const anthropicMessages: AnthropicMessageParam[] = messages
    .filter((message) => message.role !== "system")
    .map((message): AnthropicMessageParam => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

  const response = await client.messages.create({
    model,
    max_tokens: request.maxTokens ?? 1024,
    temperature: request.temperature ?? 0.2,
    ...(systemMessage ? { system: systemMessage } : {}),
    messages: anthropicMessages,
  });

  const content = response.content
    .map((item) => (item.type === "text" ? item.text : ""))
    .join("")
    .trim();

  if (!content) {
    throw new Error("anthropic returned an empty completion");
  }

  return {
    content,
    provider: "anthropic",
    model,
    usage: {
      inputTokens: response.usage.input_tokens ?? null,
      outputTokens: response.usage.output_tokens ?? null,
      totalTokens:
        (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
    },
    raw: response,
  };
}

export async function callAgentModel(
  request: AgentModelRequest
): Promise<AgentModelResponse> {
  const candidates = resolveCandidates(request.preferredProviders);

  if (candidates.length === 0) {
    throw new Error(
      "No agent model providers are configured. Set OPENROUTER_API_KEY, DEEPSEEK_API_KEY, MINIMAX_API_KEY, or ANTHROPIC_API_KEY."
    );
  }

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      if (candidate.name === "anthropic") {
        return await callAnthropicProvider(candidate.apiKey, request);
      }

      return await callOpenAiCompatibleProvider(candidate.name, candidate.apiKey, request);
    } catch (error) {
      errors.push(
        `${candidate.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new Error(`All agent model providers failed. ${errors.join(" | ")}`);
}

export function listConfiguredAgentProviders(): AgentProviderName[] {
  return getConfiguredProviders().map((candidate) => candidate.name);
}

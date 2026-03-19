export type AgentProviderName =
  | "openrouter"
  | "deepseek"
  | "minimax"
  | "anthropic";

export const AGENT_PROVIDER_ORDER: AgentProviderName[] = [
  "openrouter",
  "deepseek",
  "minimax",
  "anthropic",
];

export const DEFAULT_AGENT_PROVIDER_MODELS: Record<AgentProviderName, string> = {
  openrouter: "openai/gpt-4.1-mini",
  deepseek: "deepseek-chat",
  minimax: "MiniMax-M2.5",
  anthropic: "claude-sonnet-4-20250514",
};

export const AGENT_PROVIDER_MODEL_SUGGESTIONS: Record<AgentProviderName, string[]> = {
  openrouter: [
    "openai/gpt-4.1-mini",
    "anthropic/claude-sonnet-4",
    "google/gemini-2.5-flash",
    "minimax/minimax-m2.5",
    "minimax/minimax-m2.5:nitro",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  minimax: ["MiniMax-M2.5", "MiniMax-Text-01", "MiniMax-VL-01"],
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
};

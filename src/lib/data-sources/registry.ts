/**
 * Adapter Registry — factory pattern.
 * Adapters register themselves on import via registerAdapter().
 * The orchestrator looks up adapters by adapter_type string.
 */

import type { DataSourceAdapter } from "./types";

const adapters = new Map<string, DataSourceAdapter>();

/** Register an adapter. Called once per adapter module at import time. */
export function registerAdapter(adapter: DataSourceAdapter): void {
  if (adapters.has(adapter.id)) {
    console.warn(
      `[registry] Adapter "${adapter.id}" already registered, overwriting.`
    );
  }
  adapters.set(adapter.id, adapter);
}

/** Get an adapter by its ID (matches data_sources.adapter_type). */
export function getAdapter(id: string): DataSourceAdapter | undefined {
  return adapters.get(id);
}

/** List all registered adapter IDs. */
export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Import and register all adapters.
 * Uses dynamic imports so unused adapters don't bloat bundles.
 * Called once by the orchestrator at startup.
 */
export async function loadAllAdapters(): Promise<void> {
  await Promise.all([
    import("./adapters/huggingface"),
    import("./adapters/replicate"),
    import("./adapters/openai-models"),
    import("./adapters/anthropic-models"),
    import("./adapters/google-models"),
    import("./adapters/openrouter-models"),
    import("./adapters/artificial-analysis"),
    import("./adapters/open-llm-leaderboard"),
    import("./adapters/chatbot-arena"),
    import("./adapters/arxiv"),
    import("./adapters/hf-papers"),
    import("./adapters/github-trending"),
    import("./adapters/civitai"),
    import("./adapters/provider-news"),
    import("./adapters/x-announcements"),
    // New benchmark adapters (Phase 2)
    import("./adapters/livebench"),
    import("./adapters/seal-leaderboard"),
    import("./adapters/bigcode-leaderboard"),
    import("./adapters/open-vlm-leaderboard"),
    // Agent benchmark adapters (Phase 6)
    import("./adapters/terminal-bench"),
    import("./adapters/osworld"),
    import("./adapters/gaia-benchmark"),
    import("./adapters/webarena"),
    import("./adapters/tau-bench"),
    // Market data adapters (Phase 6)
    import("./adapters/github-stars"),
    import("./adapters/deployment-pricing"),
  ]);
}

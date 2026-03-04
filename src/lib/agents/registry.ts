/**
 * Agent Registry — factory pattern.
 * Agents register themselves on import via registerAgent().
 * The runtime looks up agents by slug string.
 */

import type { ResidentAgent } from "./types";
import { createTaggedLogger } from "@/lib/logging";

const log = createTaggedLogger("agents/registry");

const agents = new Map<string, ResidentAgent>();

/** Register an agent. Called once per agent module at import time. */
export function registerAgent(agent: ResidentAgent): void {
  if (agents.has(agent.slug)) {
    void log.warn(`Agent already registered, overwriting`, { slug: agent.slug });
  }
  agents.set(agent.slug, agent);
}

/** Get an agent by its slug (matches agents.slug). */
export function getAgent(slug: string): ResidentAgent | undefined {
  return agents.get(slug);
}

/** List all registered agent slugs. */
export function listAgents(): string[] {
  return Array.from(agents.keys());
}

/**
 * Import and register all resident agents.
 * Uses dynamic imports so unused agents don't bloat bundles.
 * Called once by the runtime at startup.
 */
export async function loadAllAgents(): Promise<void> {
  await Promise.all([
    import("./residents/pipeline-engineer"),
    import("./residents/code-quality"),
    import("./residents/ux-monitor"),
  ]);
}

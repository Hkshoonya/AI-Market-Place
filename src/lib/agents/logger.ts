/**
 * Agent Logger
 *
 * Creates a logger bound to a specific agent + task that writes
 * to the agent_logs table in Supabase.
 */

import type { AgentLogger, LogLevel } from "./types";

export function createAgentLogger(
  supabase: unknown,
  agentId: string,
  taskId: string | null
): AgentLogger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  async function log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await sb.from("agent_logs").insert({
        agent_id: agentId,
        task_id: taskId,
        level,
        message,
        metadata: metadata ?? null,
      });
    } catch {
      // Fallback to console if DB write fails
      console[level === "debug" ? "log" : level](
        `[agent:${agentId}] ${message}`,
        metadata
      );
    }
  }

  return {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
  };
}

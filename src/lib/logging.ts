/**
 * Structured logging helper.
 *
 * Writes to the `system_logs` table (created via migration) using the
 * admin Supabase client (service role — bypasses RLS).
 *
 * Falls back to console if the DB write fails so we never lose visibility.
 *
 * Usage:
 *   import { systemLog } from "@/lib/logging";
 *   await systemLog.info("sync", "Tier 1 sync completed", { sourcesRun: 3 });
 *   await systemLog.error("compute-scores", "Failed to update model", { modelId, err });
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a structured log entry to the `system_logs` table.
 * Returns the inserted row id on success, null on failure.
 */
async function writeLog(entry: LogEntry): Promise<string | null> {
  const { level, source, message, metadata } = entry;

  // Always mirror to console for Vercel's log drain
  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  consoleFn(`[${level.toUpperCase()}] [${source}] ${message}`, metadata ?? "");

  try {
    const supabase = createAdminClient();
    const sb = supabase;

    const { data, error } = await sb
      .from("system_logs")
      .insert({
        level,
        source,
        message,
        metadata: metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[logging] Failed to write system_log:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error("[logging] Exception writing system_log:", err);
    return null;
  }
}

/**
 * Convenience methods for each log level.
 */
export const systemLog = {
  info: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "info", source, message, metadata }),

  warn: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "warn", source, message, metadata }),

  error: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "error", source, message, metadata }),
};

/**
 * Agent Utilities
 *
 * Shared helpers for agent operations:
 * - Task queue management
 * - Agent stat queries
 * - Conversation helpers
 */

import type { TypedSupabaseClient } from "@/types/database";

/** Get recent tasks for an agent */
export async function getRecentTasks(
  supabase: TypedSupabaseClient,
  agentId: string,
  limit = 20
): Promise<unknown[]> {
  const sb = supabase;
  const { data } = await sb
    .from("agent_tasks")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Get recent logs for an agent */
export async function getRecentLogs(
  supabase: TypedSupabaseClient,
  agentId: string,
  level?: string,
  limit = 50
): Promise<unknown[]> {
  const sb = supabase;
  let query = sb
    .from("agent_logs")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (level) {
    query = query.eq("level", level);
  }

  const { data } = await query;
  return data ?? [];
}

/** Get error count in the last N hours */
export async function getErrorCount(
  supabase: TypedSupabaseClient,
  agentId: string,
  hours = 24
): Promise<number> {
  const sb = supabase;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("agent_logs")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("level", "error")
    .gte("created_at", since);
  return count ?? 0;
}

/** Get task stats for an agent */
export async function getTaskStats(
  supabase: TypedSupabaseClient,
  agentId: string
): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
}> {
  const sb = supabase;

  const { data } = await sb
    .from("agent_tasks")
    .select("status")
    .eq("agent_id", agentId);

  const tasks = (data ?? []) as { status: string }[];

  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
    pending: tasks.filter((t) => t.status === "pending").length,
    running: tasks.filter((t) => t.status === "running").length,
  };
}

/** Create a pending task for an agent */
export async function createTask(
  supabase: TypedSupabaseClient,
  agentId: string,
  taskType: string,
  input: Record<string, unknown> = {},
  priority = 5
): Promise<string | null> {
  const sb = supabase;
  const { data, error } = await sb
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      task_type: taskType,
      status: "pending",
      priority,
      input,
    })
    .select("id")
    .single();

  if (error) return null;
  return data?.id ?? null;
}

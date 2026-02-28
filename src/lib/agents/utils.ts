/**
 * Agent Utilities
 *
 * Shared helpers for agent operations:
 * - Task queue management
 * - Agent stat queries
 * - Conversation helpers
 */

/** Get recent tasks for an agent */
export async function getRecentTasks(
  supabase: unknown,
  agentId: string,
  limit = 20
): Promise<unknown[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
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
  supabase: unknown,
  agentId: string,
  level?: string,
  limit = 50
): Promise<unknown[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
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
  supabase: unknown,
  agentId: string,
  hours = 24
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
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
  supabase: unknown,
  agentId: string
): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

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
  supabase: unknown,
  agentId: string,
  taskType: string,
  input: Record<string, unknown> = {},
  priority = 5
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
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

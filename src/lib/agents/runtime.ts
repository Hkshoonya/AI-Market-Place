/**
 * Agent Runtime
 *
 * Executes resident agents: loads config from DB, creates tasks,
 * runs the agent, records results. Called by cron endpoints.
 */

import { createClient } from "@supabase/supabase-js";
import type { AgentRecord, AgentTask, AgentContext, AgentTaskResult } from "./types";
import { getAgent, loadAllAgents } from "./registry";
import { createAgentLogger } from "./logger";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface RuntimeResult {
  agentSlug: string;
  taskId: string | null;
  success: boolean;
  output: Record<string, unknown> | null;
  errors: string[];
  durationMs: number;
}

/**
 * Execute a resident agent by slug.
 * Creates a task, runs the agent, and records the result.
 */
export async function executeAgent(
  slug: string,
  taskType: string,
  input: Record<string, unknown> = {},
  timeoutMs = 300_000 // 5 minutes default
): Promise<RuntimeResult> {
  await loadAllAgents();

  const agent = getAgent(slug);
  if (!agent) {
    return {
      agentSlug: slug,
      taskId: null,
      success: false,
      output: null,
      errors: [`No agent registered with slug "${slug}"`],
      durationMs: 0,
    };
  }

  const supabase = createServiceClient();
  const sb = supabase;
  const startTime = Date.now();

  // Fetch agent record from DB
  const { data: agentRecord, error: agentErr } = await sb
    .from("agents")
    .select("*")
    .eq("slug", slug)
    .single();

  if (agentErr || !agentRecord) {
    return {
      agentSlug: slug,
      taskId: null,
      success: false,
      output: null,
      errors: [`Agent "${slug}" not found in database`],
      durationMs: Date.now() - startTime,
    };
  }

  const record = agentRecord as AgentRecord;

  // Check if agent is active
  if (record.status !== "active") {
    return {
      agentSlug: slug,
      taskId: null,
      success: false,
      output: null,
      errors: [`Agent "${slug}" is ${record.status}, skipping`],
      durationMs: Date.now() - startTime,
    };
  }

  // Create task record
  const { data: taskData, error: taskErr } = await sb
    .from("agent_tasks")
    .insert({
      agent_id: record.id,
      task_type: taskType,
      status: "running",
      priority: 5,
      input,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (taskErr || !taskData) {
    return {
      agentSlug: slug,
      taskId: null,
      success: false,
      output: null,
      errors: [`Failed to create task: ${taskErr?.message ?? "unknown"}`],
      durationMs: Date.now() - startTime,
    };
  }

  const task = taskData as AgentTask;
  const logger = createAgentLogger(sb, record.id, task.id);

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Create execution context
  const ctx: AgentContext = {
    supabase: sb,
    agent: record,
    task,
    log: logger,
    signal: controller.signal,
  };

  let result: AgentTaskResult;

  try {
    await logger.info(`Starting task: ${taskType}`, { input });

    // Race agent execution against hard timeout for guaranteed termination
    const timeoutPromise = new Promise<AgentTaskResult>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error(`Agent timed out after ${timeoutMs}ms`));
      });
    });

    result = await Promise.race([agent.run(ctx), timeoutPromise]);

    await logger.info(`Task completed: ${result.success ? "success" : "failed"}`, {
      output: result.output,
      errors: result.errors,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logger.error(`Task crashed: ${errMsg}`);
    result = {
      success: false,
      output: {},
      errors: [errMsg],
    };
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startTime;
  const taskStatus = result.success ? "completed" : "failed";

  // Update task record
  const { error: taskUpdateErr } = await sb
    .from("agent_tasks")
    .update({
      status: taskStatus,
      output: result.output,
      error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  if (taskUpdateErr) {
    console.error(`Failed to update task ${task.id}:`, taskUpdateErr.message);
  }

  // Update agent stats
  const updates: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (result.success) {
    updates.total_tasks_completed = record.total_tasks_completed + 1;
    // Reset error count on success
    if (record.error_count > 0) {
      updates.error_count = 0;
    }
  } else {
    updates.error_count = record.error_count + 1;
    // Auto-disable agent after 10 consecutive failures
    if (record.error_count + 1 >= 10) {
      updates.status = "error";
      await logger.error("Agent auto-disabled after 10 consecutive failures");
    }
  }

  const { error: agentUpdateErr } = await sb.from("agents").update(updates).eq("id", record.id);
  if (agentUpdateErr) {
    console.error(`Failed to update agent ${record.id}:`, agentUpdateErr.message);
  }

  return {
    agentSlug: slug,
    taskId: task.id,
    success: result.success,
    output: result.output,
    errors: result.errors,
    durationMs,
  };
}

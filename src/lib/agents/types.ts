/**
 * Agent Infrastructure — Type Definitions
 *
 * Every resident agent implements ResidentAgent.
 * The agent runtime reads agent config from the agents table,
 * creates tasks, and executes them via the agent's run() method.
 */

export type AgentType = "resident" | "marketplace" | "visitor";
export type AgentStatus = "active" | "paused" | "disabled" | "error";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type MessageType = "text" | "tool_call" | "tool_result" | "system";
export type ApiKeyScope = "read" | "write" | "agent" | "mcp" | "marketplace";

/** Record from the agents table */
export interface AgentRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  agent_type: AgentType;
  owner_id: string | null;
  status: AgentStatus;
  capabilities: string[];
  config: Record<string, unknown>;
  mcp_endpoint: string | null;
  api_key_hash: string | null;
  last_active_at: string | null;
  total_tasks_completed: number;
  total_conversations: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

/** Record from the agent_tasks table */
export interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  status: TaskStatus;
  priority: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Record from the agent_logs table */
export interface AgentLog {
  id: number;
  agent_id: string;
  task_id: string | null;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Record from the api_keys table */
export interface ApiKey {
  id: string;
  owner_id: string;
  agent_id: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** Record from agent_conversations table */
export interface AgentConversation {
  id: string;
  participant_a: string;
  participant_b: string;
  participant_a_type: "agent" | "user";
  participant_b_type: "agent" | "user";
  topic: string | null;
  status: "active" | "closed" | "archived";
  message_count: number;
  created_at: string;
  updated_at: string;
}

/** Record from agent_messages table */
export interface AgentMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: "agent" | "user";
  content: string;
  message_type: MessageType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Context passed to resident agent run() */
export interface AgentContext {
  /** Service-role Supabase client — full DB access */
  supabase: unknown;
  /** Agent record from the database */
  agent: AgentRecord;
  /** Task being executed */
  task: AgentTask;
  /** Logger bound to this agent + task */
  log: AgentLogger;
  /** AbortSignal for timeout control */
  signal?: AbortSignal;
}

/** Logger interface for agents */
export interface AgentLogger {
  debug(message: string, metadata?: Record<string, unknown>): Promise<void>;
  info(message: string, metadata?: Record<string, unknown>): Promise<void>;
  warn(message: string, metadata?: Record<string, unknown>): Promise<void>;
  error(message: string, metadata?: Record<string, unknown>): Promise<void>;
}

/** Result of an agent task execution */
export interface AgentTaskResult {
  success: boolean;
  output: Record<string, unknown>;
  errors: string[];
}

/** Every resident agent implements this interface */
export interface ResidentAgent {
  /** Unique slug — must match agents.slug */
  slug: string;
  /** Human-readable name */
  name: string;

  /**
   * Execute the agent's main logic.
   * Called by the runtime when the cron trigger fires.
   */
  run(ctx: AgentContext): Promise<AgentTaskResult>;
}

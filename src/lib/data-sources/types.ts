/**
 * Data Source Aggregation Engine — Type Definitions
 *
 * Every adapter implements DataSourceAdapter.
 * The orchestrator reads data_sources table config, resolves secrets from env,
 * and calls adapter.sync() with a SyncContext.
 */

import type { TypedSupabaseClient } from "@/types/database";

export type SyncOutputType =
  | "models"
  | "benchmarks"
  | "pricing"
  | "elo_ratings"
  | "news"
  | "rankings";

export type SyncStatus = "success" | "partial" | "failed";

/** Record from the data_sources table */
export interface DataSourceRecord {
  id: number;
  slug: string;
  name: string;
  adapter_type: string;
  description: string | null;
  is_enabled: boolean;
  tier: number;
  sync_interval_hours: number;
  priority: number;
  config: Record<string, unknown>;
  secret_env_keys: string[];
  output_types: SyncOutputType[];
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
  last_sync_records: number;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Passed to every adapter.sync() call */
export interface SyncContext {
  /** Service-role Supabase client — full DB access */
  supabase: TypedSupabaseClient;
  /** Adapter-specific config from data_sources.config JSONB */
  config: Record<string, unknown>;
  /** Resolved env var values keyed by the var name */
  secrets: Record<string, string>;
  /** ISO timestamp of last successful sync, or null if first run */
  lastSyncAt: string | null;
  /** AbortSignal for timeout control */
  signal?: AbortSignal;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: SyncError[];
  /** Cursor for chunked syncs — stored in sync_jobs.metadata */
  cursor?: string;
  /** Arbitrary metadata to store in sync_jobs */
  metadata?: Record<string, unknown>;
}

export interface SyncError {
  message: string;
  context?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

/** Every adapter implements this interface */
export interface DataSourceAdapter {
  /** Unique adapter identifier — must match data_sources.adapter_type */
  id: string;
  /** Human-readable name */
  name: string;
  /** What tables this adapter writes to */
  outputTypes: SyncOutputType[];
  /** Default config values (merged with DB config at runtime) */
  defaultConfig: Record<string, unknown>;
  /** Required env var names */
  requiredSecrets: string[];

  /**
   * Fetch data from the external source and upsert into Supabase.
   * Must be idempotent — safe to call repeatedly.
   */
  sync(ctx: SyncContext): Promise<SyncResult>;

  /**
   * Quick health check — can the source be reached?
   * Should complete in < 5 seconds.
   */
  healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult>;
}

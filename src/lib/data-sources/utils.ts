/**
 * Shared utilities for data source adapters:
 * - fetchWithRetry: fetch with exponential backoff
 * - createRateLimitedFetch: fetch with delay between calls
 * - upsertBatch: batch upsert into Supabase
 * - makeSlug: generate URL-safe slugs
 * - resolveSecrets: resolve env var names to values
 */

import type { SyncError } from "./types";
import type { TypedSupabaseClient } from "@/types/database";

// --------------- Retry & Fetch ---------------

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
}

/**
 * Fetch with exponential backoff retry.
 * Retries on 429, 500, 502, 503, 504 status codes.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 1000, signal } = options ?? {};

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal });

      // Don't retry client errors (except 429)
      if (
        res.ok ||
        (res.status >= 400 && res.status < 500 && res.status !== 429)
      ) {
        return res;
      }

      // Retry on server errors and rate limits
      if (attempt < maxRetries) {
        const retryAfter = res.headers.get("retry-after");
        const delayMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }

      return res; // Return last failed response
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt >= maxRetries) throw err;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  throw new Error("fetchWithRetry: exhausted retries");
}

/**
 * Create a rate-limited fetch function with a minimum delay between calls.
 */
export function createRateLimitedFetch(delayMs: number) {
  let lastCall = 0;

  return async (
    url: string,
    init?: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed < delayMs) {
      await sleep(delayMs - elapsed);
    }
    lastCall = Date.now();
    return fetchWithRetry(url, { ...init, signal }, { signal });
  };
}

// --------------- Supabase Helpers ---------------

/**
 * Batch upsert records into a Supabase table.
 * Uses ON CONFLICT to handle duplicates.
 */
export async function upsertBatch(
  supabase: TypedSupabaseClient,
  table: string,
  records: Record<string, unknown>[],
  conflictColumn: string,
  batchSize = 100
): Promise<{ created: number; errors: SyncError[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let totalCreated = 0;
  const errors: SyncError[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error, count } = await sb
      .from(table)
      .upsert(batch, { onConflict: conflictColumn, count: "exact" });

    if (error) {
      errors.push({
        message: `Upsert batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`,
        context: `table=${table}, batchStart=${i}, batchSize=${batch.length}`,
      });
    } else {
      totalCreated += count ?? batch.length;
    }
  }

  return { created: totalCreated, errors };
}

// --------------- String Helpers ---------------

/** Generate a URL-safe slug from any string */
export function makeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// --------------- Env / Secrets ---------------

/**
 * Resolve env var names to their values.
 *
 * Returns a structured result so callers can decide how to handle missing
 * secrets rather than silently running without them.
 *
 * @returns `{ secrets }` — map of key → value for present vars
 *          `{ missing }` — list of keys that were absent or empty
 */
export function resolveSecrets(envKeys: string[]): {
  secrets: Record<string, string>;
  missing: string[];
} {
  const secrets: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of envKeys) {
    const value = process.env[key];
    if (value) {
      secrets[key] = value;
    } else {
      missing.push(key);
    }
  }
  return { secrets, missing };
}

// --------------- Time Helpers ---------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if a source needs syncing based on last_sync_at and interval */
export function needsSync(
  lastSyncAt: string | null,
  intervalHours: number
): boolean {
  if (!lastSyncAt) return true;
  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const intervalMs = intervalHours * 60 * 60 * 1000;
  return now - lastSync >= intervalMs;
}

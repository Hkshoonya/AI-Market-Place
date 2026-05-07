import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface AdminClientConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function readAdminClientConfig(): AdminClientConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

export function hasAdminClientConfig() {
  return readAdminClientConfig() !== null;
}

function getAdminClientConfig(): AdminClientConfig {
  const config = readAdminClientConfig();

  if (config) {
    return config;
  }

  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  throw new Error(`Missing Supabase admin configuration: ${missing.join(", ")}`);
}

// Admin client with service role key — server-side only, bypasses RLS
export function createAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getAdminClientConfig();

  return createClient<Database>(
    supabaseUrl,
    serviceRoleKey
  );
}

// Build-safe helper for pages that can fall back to public reads during prerender.
export function createOptionalAdminClient() {
  const config = readAdminClientConfig();

  if (!config) {
    return null;
  }

  return createClient<Database>(config.supabaseUrl, config.serviceRoleKey);
}

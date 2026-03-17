import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Admin client with service role key — server-side only, bypasses RLS
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Build-safe helper for pages that can fall back to public reads during prerender.
export function createOptionalAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey);
}

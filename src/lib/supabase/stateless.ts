import { createClient } from "@supabase/supabase-js";

// Request/job-scoped database clients never own an interactive user session.
// Auth's default interval otherwise retains every client after the request ends.
export const createStatelessClient: typeof createClient = (url, key, options) =>
  createClient(url, key, {
    ...options,
    auth: {
      ...options?.auth,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

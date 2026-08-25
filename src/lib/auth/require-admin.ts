import { NextResponse } from "next/server";

import { systemLog } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

export type AdminSessionResult =
  | { user: { id: string }; error?: never }
  | { user?: never; error: NextResponse };

/**
 * Authorize an admin request from the current Supabase session.
 * Admin status is always read server-side and banned accounts are rejected.
 */
export async function requireAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, is_banned")
    .eq("id", user.id)
    .single();

  if (profileError) {
    void systemLog.error(
      "auth/require-admin",
      "Could not verify administrator profile",
      { userId: user.id, error: profileError.message }
    );
    return {
      error: NextResponse.json(
        { error: "Could not verify administrator access." },
        { status: 500 }
      ),
    };
  }

  if (!profile?.is_admin || profile.is_banned) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user: { id: user.id } };
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { runSingleSync } from "@/lib/data-sources/orchestrator";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/sync/[source] — manually trigger sync for one source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-sync-trigger:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    const result = await runSingleSync(source);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err, "api/admin/sync");
  }
}

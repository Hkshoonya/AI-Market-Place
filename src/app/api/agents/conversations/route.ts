import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { extractApiKey, validateApiKey } from "@/lib/agents/auth";
import { assertUuid } from "@/lib/utils/sanitize";
import { rateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  try {
    const supabase = createServiceClient();

    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key required" },
        { status: 401 }
      );
    }

    const auth = await validateApiKey(supabase, apiKey);
    if (!auth.valid || !auth.keyRecord) {
      return NextResponse.json(
        { error: auth.error ?? "Invalid API key" },
        { status: 401 }
      );
    }

    const keyId = auth.keyRecord.id as string;
    const rl = await rateLimit(`conversations:${keyId}`, RATE_LIMITS.api);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    // Verify agent scope
    const scopes = (auth.keyRecord.scopes as string[]) ?? [];
    if (!scopes.includes("agent")) {
      return NextResponse.json(
        { error: "API key missing 'agent' scope" },
        { status: 403 }
      );
    }

    const ownerId = assertUuid(
      (auth.keyRecord.agent_id as string) ??
        (auth.keyRecord.owner_id as string),
      "owner_id"
    );

    const { data, error } = await supabase
      .from("agent_conversations")
      .select("*")
      .or(`participant_a.eq.${ownerId},participant_b.eq.${ownerId}`)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    return handleApiError(err, "api/agents/conversations");
  }
}

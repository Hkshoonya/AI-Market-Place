import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractApiKey, validateApiKey } from "@/lib/agents/auth";
import { assertUuid } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required" },
      { status: 401 }
    );
  }

  const auth = await validateApiKey(sb, apiKey);
  if (!auth.valid || !auth.keyRecord) {
    return NextResponse.json(
      { error: auth.error ?? "Invalid API key" },
      { status: 401 }
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

  const { data, error } = await sb
    .from("agent_conversations")
    .select("*")
    .or(`participant_a.eq.${ownerId},participant_b.eq.${ownerId}`)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

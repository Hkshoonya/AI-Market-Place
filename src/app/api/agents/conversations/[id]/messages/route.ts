import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractApiKey, validateApiKey } from "@/lib/agents/auth";
import { getMessages } from "@/lib/agents/chat";

export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const auth = await validateApiKey(sb, apiKey);
  if (!auth.valid || !auth.keyRecord) {
    return NextResponse.json(
      { error: auth.error ?? "Invalid API key" },
      { status: 401 }
    );
  }

  // Verify participant
  const ownerId =
    (auth.keyRecord.agent_id as string) ??
    (auth.keyRecord.owner_id as string);

  const { data: conversation } = await sb
    .from("agent_conversations")
    .select("participant_a, participant_b")
    .eq("id", id)
    .single();

  if (
    !conversation ||
    (conversation.participant_a !== ownerId &&
      conversation.participant_b !== ownerId)
  ) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50"),
    100
  );

  const messages = await getMessages(sb, id, limit);

  return NextResponse.json({ messages });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { extractApiKey, validateApiKey } from "@/lib/agents/auth";
import { getMessages } from "@/lib/agents/chat";
import { rateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServiceClient();

    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    const auth = await validateApiKey(supabase, apiKey);
    if (!auth.valid || !auth.keyRecord) {
      return NextResponse.json(
        { error: auth.error ?? "Invalid API key" },
        { status: 401 }
      );
    }

    const keyId = auth.keyRecord.id as string;
    const rl = rateLimit(`conversation-messages:${keyId}`, RATE_LIMITS.api);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    // Verify participant
    const ownerId =
      (auth.keyRecord.agent_id as string) ??
      (auth.keyRecord.owner_id as string);

    const { data: conversation } = await supabase
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

    const messages = await getMessages(supabase, id, limit);

    return NextResponse.json({ messages });
  } catch (err) {
    return handleApiError(err, "api/agents/conversations/messages");
  }
}

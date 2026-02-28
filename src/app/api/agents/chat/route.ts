import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractApiKey, validateApiKey, hasScope } from "@/lib/agents/auth";
import { rateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import {
  findOrCreateConversation,
  sendMessage,
  generateAgentResponse,
} from "@/lib/agents/chat";

export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Authenticate
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required. Use Authorization: Bearer aimk_..." },
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

  if (!hasScope(auth.keyRecord, "agent")) {
    return NextResponse.json(
      { error: "API key missing 'agent' scope" },
      { status: 403 }
    );
  }

  // Rate limit per API key
  const keyId = auth.keyRecord.id as string;
  const rl = rateLimit(`agent-chat:${keyId}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Parse request body
  let body: { agent_slug: string; message: string; topic?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.agent_slug || !body.message) {
    return NextResponse.json(
      { error: "agent_slug and message are required" },
      { status: 400 }
    );
  }

  // Find the target agent
  const { data: targetAgent, error: agentErr } = await sb
    .from("agents")
    .select("id, slug, name, status, total_conversations")
    .eq("slug", body.agent_slug)
    .single();

  if (agentErr || !targetAgent) {
    return NextResponse.json(
      { error: `Agent "${body.agent_slug}" not found` },
      { status: 404 }
    );
  }

  if (targetAgent.status !== "active") {
    return NextResponse.json(
      { error: `Agent "${body.agent_slug}" is ${targetAgent.status}` },
      { status: 400 }
    );
  }

  // Determine sender identity
  const senderId =
    (auth.keyRecord.agent_id as string) ??
    (auth.keyRecord.owner_id as string);
  const senderType = auth.keyRecord.agent_id ? "agent" : "user";

  try {
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      sb,
      senderId,
      senderType as "agent" | "user",
      targetAgent.id,
      "agent",
      body.topic
    );

    // Send the user/bot message
    const sentMessage = await sendMessage(
      sb,
      conversation.id,
      senderId,
      senderType as "agent" | "user",
      body.message,
      "text"
    );

    // Generate auto-response from resident agent
    const agentResponse = await generateAgentResponse(
      sb,
      body.agent_slug,
      conversation.id,
      body.message
    );

    // Update agent conversation count
    await sb
      .from("agents")
      .update({
        total_conversations: (targetAgent.total_conversations ?? 0) + 1,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", targetAgent.id);

    return NextResponse.json({
      conversation_id: conversation.id,
      message: sentMessage,
      response: agentResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}

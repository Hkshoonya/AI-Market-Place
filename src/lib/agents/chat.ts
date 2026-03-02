/**
 * Agent Chat — Conversation Manager
 *
 * Manages bot-to-bot and user-to-bot conversations.
 * Resident agents can auto-respond using Anthropic API.
 */

import type { AgentConversation, AgentMessage } from "./types";
import { assertUuid } from "@/lib/utils/sanitize";

/** Find or create a conversation between two participants */
export async function findOrCreateConversation(
  supabase: unknown,
  participantA: string,
  participantAType: "agent" | "user",
  participantB: string,
  participantBType: "agent" | "user",
  topic?: string
): Promise<{ conversation: AgentConversation; created: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Validate UUIDs before interpolating into .or() filter
  const pA = assertUuid(participantA, "participantA");
  const pB = assertUuid(participantB, "participantB");

  // Check for existing active conversation between these participants
  const { data: existing } = await sb
    .from("agent_conversations")
    .select("*")
    .eq("status", "active")
    .or(
      `and(participant_a.eq.${pA},participant_b.eq.${pB}),and(participant_a.eq.${pB},participant_b.eq.${pA})`
    )
    .limit(1)
    .single();

  if (existing) return { conversation: existing as AgentConversation, created: false };

  // Create new conversation (handle race condition with retry on conflict)
  const { data, error } = await sb
    .from("agent_conversations")
    .insert({
      participant_a: participantA,
      participant_b: participantB,
      participant_a_type: participantAType,
      participant_b_type: participantBType,
      topic: topic ?? null,
      status: "active",
      message_count: 0,
    })
    .select("*")
    .single();

  if (error) {
    // Race condition: another request may have created the conversation first
    // Retry the lookup before throwing
    const { data: retryExisting } = await sb
      .from("agent_conversations")
      .select("*")
      .eq("status", "active")
      .or(
        `and(participant_a.eq.${pA},participant_b.eq.${pB}),and(participant_a.eq.${pB},participant_b.eq.${pA})`
      )
      .limit(1)
      .single();

    if (retryExisting) return { conversation: retryExisting as AgentConversation, created: false };
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return { conversation: data as AgentConversation, created: true };
}

/** Send a message in a conversation */
export async function sendMessage(
  supabase: unknown,
  conversationId: string,
  senderId: string,
  senderType: "agent" | "user",
  content: string,
  messageType: "text" | "tool_call" | "tool_result" | "system" = "text",
  metadata?: Record<string, unknown>
): Promise<AgentMessage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data, error } = await sb
    .from("agent_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_type: senderType,
      content,
      message_type: messageType,
      metadata: metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to send message: ${error.message}`);

  // Update conversation activity timestamp
  // message_count is not atomically incremented here to avoid read-then-write races;
  // derive accurate counts from agent_messages table when needed
  sb.from("agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .then(() => {});

  return data as AgentMessage;
}

/** Get messages in a conversation */
export async function getMessages(
  supabase: unknown,
  conversationId: string,
  limit = 50,
  before?: string
): Promise<AgentMessage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let query = sb
    .from("agent_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data } = await query;
  return (data ?? []) as AgentMessage[];
}

/** Generate an auto-response from a resident agent */
export async function generateAgentResponse(
  supabase: unknown,
  agentSlug: string,
  conversationId: string,
  incomingMessage: string
): Promise<AgentMessage | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch agent record
  const { data: agent } = await sb
    .from("agents")
    .select("*")
    .eq("slug", agentSlug)
    .eq("status", "active")
    .single();

  if (!agent) return null;

  // Get recent conversation history for context
  const history = await getMessages(sb, conversationId, 20);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    // Without Anthropic API, return a simple acknowledgment
    return sendMessage(
      sb,
      conversationId,
      agent.id,
      "agent",
      `I'm ${agent.name}. I received your message but AI-powered responses require the Anthropic API key to be configured. My capabilities include: ${(agent.capabilities as string[]).join(", ")}.`,
      "text"
    );
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });

    // Build conversation context
    const messages = history.map((msg) => ({
      role:
        msg.sender_type === "agent" && msg.sender_id === agent.id
          ? ("assistant" as const)
          : ("user" as const),
      content: msg.content,
    }));

    // Add the new incoming message
    messages.push({ role: "user" as const, content: incomingMessage });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are ${agent.name}, a resident AI agent on the AI Market Cap platform. ${agent.description ?? ""}

Your capabilities: ${(agent.capabilities as string[]).join(", ")}

You help users and other bots with questions about AI models, the marketplace, data pipelines, and the platform. Be concise, helpful, and professional. If asked about something outside your capabilities, say so.`,
      messages,
    });

    const responseText =
      response.content[0].type === "text"
        ? response.content[0].text
        : "I processed your request but couldn't generate a text response.";

    // Send the response as the agent
    return sendMessage(
      sb,
      conversationId,
      agent.id,
      "agent",
      responseText,
      "text",
      { model: "claude-sonnet-4-20250514", usage: response.usage }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return sendMessage(
      sb,
      conversationId,
      agent.id,
      "agent",
      `I encountered an error processing your message: ${errMsg}`,
      "system"
    );
  }
}

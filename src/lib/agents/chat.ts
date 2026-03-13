/**
 * Agent Chat - Conversation Manager
 *
 * Manages bot-to-bot and user-to-bot conversations.
 * Resident agents can auto-respond using the shared provider router.
 */

import type { AgentConversation, AgentMessage } from "./types";
import type { TypedSupabaseClient } from "@/types/database";
import { assertUuid } from "@/lib/utils/sanitize";
import { callAgentModel } from "./provider-router";

interface AgentReplyAgent {
  id: string;
  name: string;
  description: string | null;
  capabilities: string[];
}

interface AgentReplyHistoryItem {
  sender_id: string;
  sender_type: "agent" | "user";
  content: string;
}

/** Find or create a conversation between two participants */
export async function findOrCreateConversation(
  supabase: TypedSupabaseClient,
  participantA: string,
  participantAType: "agent" | "user",
  participantB: string,
  participantBType: "agent" | "user",
  topic?: string
): Promise<{ conversation: AgentConversation; created: boolean }> {
  const sb = supabase;

  const pA = assertUuid(participantA, "participantA");
  const pB = assertUuid(participantB, "participantB");

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
  supabase: TypedSupabaseClient,
  conversationId: string,
  senderId: string,
  senderType: "agent" | "user",
  content: string,
  messageType: "text" | "tool_call" | "tool_result" | "system" = "text",
  metadata?: Record<string, unknown>
): Promise<AgentMessage> {
  const sb = supabase;

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

  sb.from("agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .then(() => {});

  return data as AgentMessage;
}

/** Get messages in a conversation */
export async function getMessages(
  supabase: TypedSupabaseClient,
  conversationId: string,
  limit = 50,
  before?: string
): Promise<AgentMessage[]> {
  const sb = supabase;

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

export async function generateAgentReply(
  agent: AgentReplyAgent,
  history: AgentReplyHistoryItem[],
  incomingMessage: string
): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const messages = history.map((msg) => ({
    role:
      msg.sender_type === "agent" && msg.sender_id === agent.id
        ? ("assistant" as const)
        : ("user" as const),
    content: msg.content,
  }));

  messages.push({ role: "user" as const, content: incomingMessage });

  const response = await callAgentModel({
    system: `You are ${agent.name}, a resident AI agent on the AI Market Cap platform. ${agent.description ?? ""}

Your capabilities: ${agent.capabilities.join(", ")}

You help users and other bots with questions about AI models, the marketplace, data pipelines, and the platform. Be concise, helpful, and professional. If asked about something outside your capabilities, say so.`,
    messages,
    maxTokens: 1024,
  });

  return {
    content: response.content,
    metadata: {
      provider: response.provider,
      model: response.model,
      usage: response.usage,
    },
  };
}

/** Generate an auto-response from a resident agent */
export async function generateAgentResponse(
  supabase: TypedSupabaseClient,
  agentSlug: string,
  conversationId: string,
  incomingMessage: string
): Promise<AgentMessage | null> {
  const sb = supabase;

  const { data: agent } = await sb
    .from("agents")
    .select("*")
    .eq("slug", agentSlug)
    .eq("status", "active")
    .single();

  if (!agent) return null;

  const history = await getMessages(sb, conversationId, 20);

  try {
    const reply = await generateAgentReply(
      {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        capabilities: (agent.capabilities as string[]) ?? [],
      },
      history,
      incomingMessage
    );

    return sendMessage(
      sb,
      conversationId,
      agent.id,
      "agent",
      reply.content,
      "text",
      reply.metadata
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const fallback =
      errMsg.includes("No agent model providers are configured")
        ? `I'm ${agent.name}. I received your message but no LLM provider is configured for autonomous responses. My capabilities include: ${(agent.capabilities as string[]).join(", ")}.`
        : `I encountered an error processing your message: ${errMsg}`;

    return sendMessage(
      sb,
      conversationId,
      agent.id,
      "agent",
      fallback,
      "system"
    );
  }
}

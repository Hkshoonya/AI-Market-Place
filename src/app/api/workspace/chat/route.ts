import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findOrCreateConversation,
  sendMessage,
  generateAgentResponse,
} from "@/lib/agents/chat";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversation_id: z.string().trim().min(1).optional(),
  agent_slug: z.string().trim().min(1).default("pipeline-engineer"),
  topic: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: targetAgent, error: agentError } = await admin
      .from("agents")
      .select("id, slug, name, status, total_conversations")
      .eq("slug", parsed.data.agent_slug)
      .single();

    if (agentError || !targetAgent) {
      return NextResponse.json(
        { error: `Agent "${parsed.data.agent_slug}" not found` },
        { status: 404 }
      );
    }

    if (targetAgent.status !== "active") {
      return NextResponse.json(
        { error: `Agent "${parsed.data.agent_slug}" is ${targetAgent.status}` },
        { status: 400 }
      );
    }

    const conversationResult = parsed.data.conversation_id
      ? {
          conversation: {
            id: parsed.data.conversation_id,
          },
          created: false,
        }
      : await findOrCreateConversation(
          admin,
          user.id,
          "user",
          targetAgent.id,
          "agent",
          parsed.data.topic
        );

    const conversationId = conversationResult.conversation.id;

    const sentMessage = await sendMessage(
      admin,
      conversationId,
      user.id,
      "user",
      parsed.data.message,
      "text"
    );

    const response = await generateAgentResponse(
      admin,
      parsed.data.agent_slug,
      conversationId,
      parsed.data.message
    );

    const agentUpdates: Record<string, unknown> = {
      last_active_at: new Date().toISOString(),
    };
    if (conversationResult.created) {
      agentUpdates.total_conversations = (targetAgent.total_conversations ?? 0) + 1;
    }

    await admin.from("agents").update(agentUpdates).eq("id", targetAgent.id);

    return NextResponse.json({
      conversation_id: conversationId,
      message: sentMessage,
      response,
      agent: {
        slug: targetAgent.slug,
        name: targetAgent.name,
      },
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/chat");
  }
}

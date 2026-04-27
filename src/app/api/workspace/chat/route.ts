import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findOrCreateConversation,
  getMessages,
  sendMessage,
  generateAgentResponse,
} from "@/lib/agents/chat";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversation_id: z.string().trim().min(1).optional(),
  runtime_id: z.string().trim().min(1).optional(),
  agent_slug: z.string().trim().min(1).default("pipeline-engineer"),
  topic: z.string().trim().max(200).optional(),
});

const QuerySchema = z.object({
  conversation_id: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

async function loadWorkspaceConversation(input: {
  conversationId: string;
  userId: string;
}) {
  const admin = createAdminClient();

  const { data: conversation, error: conversationError } = await admin
    .from("agent_conversations")
    .select("id, participant_a, participant_b")
    .eq("id", input.conversationId)
    .single();

  if (conversationError || !conversation) {
    return { error: "Conversation not found", status: 404 as const };
  }

  if (
    conversation.participant_a !== input.userId &&
    conversation.participant_b !== input.userId
  ) {
    return { error: "Conversation not found", status: 404 as const };
  }

  const messages = await getMessages(admin, input.conversationId, 100);
  return { conversation, messages };
}

async function loadWorkspaceRuntime(input: { runtimeId: string; userId: string }) {
  const admin = createAdminClient();
  const { data: runtime, error } = await admin
    .from("workspace_runtimes")
    .select("id, user_id, total_requests, total_tokens")
    .eq("id", input.runtimeId)
    .single();

  if (error || !runtime || runtime.user_id !== input.userId) {
    return { error: "Runtime not found", status: 404 as const };
  }

  return { runtime };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      conversation_id: url.searchParams.get("conversation_id"),
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const result = await loadWorkspaceConversation({
      conversationId: parsed.data.conversation_id,
      userId: user.id,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      messages: result.messages.slice(-parsed.data.limit),
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/chat");
  }
}

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

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
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
      ? await loadWorkspaceConversation({
          conversationId: parsed.data.conversation_id,
          userId: user.id,
        })
      : await findOrCreateConversation(
          admin,
          user.id,
          "user",
          targetAgent.id,
          "agent",
          parsed.data.topic
        );

    if ("error" in conversationResult) {
      return NextResponse.json(
        { error: conversationResult.error },
        { status: conversationResult.status }
      );
    }

    const runtimeResult = parsed.data.runtime_id
      ? await loadWorkspaceRuntime({
          runtimeId: parsed.data.runtime_id,
          userId: user.id,
        })
      : null;

    if (runtimeResult && "error" in runtimeResult) {
      return NextResponse.json(
        { error: runtimeResult.error },
        { status: runtimeResult.status }
      );
    }

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
    if ("created" in conversationResult && conversationResult.created) {
      agentUpdates.total_conversations = (targetAgent.total_conversations ?? 0) + 1;
    }

    await admin.from("agents").update(agentUpdates).eq("id", targetAgent.id);

    if (parsed.data.runtime_id && runtimeResult && "runtime" in runtimeResult) {
      const usageMetadata =
        response &&
        typeof response === "object" &&
        response.metadata &&
        typeof response.metadata === "object" &&
        "usage" in response.metadata &&
        response.metadata.usage &&
        typeof response.metadata.usage === "object"
          ? (response.metadata.usage as { totalTokens?: unknown })
          : null;
      const totalTokens =
        typeof usageMetadata?.totalTokens === "number" ? usageMetadata.totalTokens : 0;

      await admin
        .from("workspace_runtimes")
        .update({
          total_requests: (runtimeResult.runtime.total_requests ?? 0) + 1,
          total_tokens: Number(runtimeResult.runtime.total_tokens ?? 0) + totalTokens,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", parsed.data.runtime_id);
    }

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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findOrCreateConversation,
  sendMessage,
  generateAgentResponse,
} from "@/lib/agents/chat";
import { buildWorkspaceRuntimeAssistantPath } from "@/lib/workspace/runtime";
import { rejectUntrustedSessionOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

const WORKSPACE_AGENT_SLUG = "pipeline-engineer";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpointSlug: string }> }
) {
  try {
    const auth = await resolveAuthUser(request, ["agent"]);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const originError = rejectUntrustedSessionOrigin(request, auth.authMethod);
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

    const { endpointSlug } = await params;
    const admin = createAdminClient();
    const { data: runtime, error: runtimeError } = await admin
      .from("workspace_runtimes")
      .select(
        "id, model_slug, model_name, provider_name, endpoint_slug, total_requests, total_tokens, workspace_conversation_id"
      )
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (runtimeError || !runtime) {
      return NextResponse.json({ error: "Runtime not found" }, { status: 404 });
    }

    const { data: targetAgent, error: agentError } = await admin
      .from("agents")
      .select("id, slug, name, status, total_conversations")
      .eq("slug", WORKSPACE_AGENT_SLUG)
      .single();

    if (agentError || !targetAgent) {
      return NextResponse.json({ error: "Workspace agent not found" }, { status: 404 });
    }

    if (targetAgent.status !== "active") {
      return NextResponse.json(
        { error: `Workspace agent is ${targetAgent.status}` },
        { status: 400 }
      );
    }

    const existingConversationId = runtime.workspace_conversation_id ?? undefined;

    const conversationResult = existingConversationId
      ? { conversation: { id: existingConversationId }, created: false }
      : await findOrCreateConversation(
          admin,
          auth.userId,
          "user",
          targetAgent.id,
          "agent",
          runtime.model_name ? `Runtime assistant for ${runtime.model_name}` : "Runtime assistant"
        );

    const conversationId = conversationResult.conversation.id;

    if (!runtime.workspace_conversation_id && conversationId) {
      await admin
        .from("workspace_runtimes")
        .update({ workspace_conversation_id: conversationId })
        .eq("id", runtime.id);
    }

    const sentMessage = await sendMessage(
      admin,
      conversationId,
      auth.userId,
      "user",
      parsed.data.message,
      "text"
    );

    const response = await generateAgentResponse(
      admin,
      WORKSPACE_AGENT_SLUG,
      conversationId,
      parsed.data.message
    );

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
        total_requests: (runtime.total_requests ?? 0) + 1,
        total_tokens: Number(runtime.total_tokens ?? 0) + totalTokens,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", runtime.id);

    return NextResponse.json({
      conversation_id: conversationId,
      message: sentMessage,
      response,
      runtime: {
        id: runtime.id,
        modelSlug: runtime.model_slug,
        modelName: runtime.model_name,
        providerName: runtime.provider_name,
        endpointSlug: runtime.endpoint_slug,
        assistantPath: buildWorkspaceRuntimeAssistantPath(runtime.endpoint_slug),
      },
    });
  } catch (error) {
    return handleApiError(error, "api/runtime/[endpointSlug]/assistant");
  }
}

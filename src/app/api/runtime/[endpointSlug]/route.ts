import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAgentModel } from "@/lib/agents/provider-router";
import {
  buildWorkspaceRuntimeAssistantPath,
  buildWorkspaceRuntimeEndpointPath,
} from "@/lib/workspace/runtime";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  system: z.string().trim().max(4000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpointSlug: string }> }
) {
  try {
    const auth = await resolveAuthUser(request, ["read", "agent"]);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpointSlug } = await params;
    const admin = createAdminClient();
    const { data: runtime, error } = await admin
      .from("workspace_runtimes")
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (error || !runtime) {
      return NextResponse.json({ error: "Runtime not found" }, { status: 404 });
    }

    const execution = resolveWorkspaceRuntimeExecution(runtime.model_slug);

    return NextResponse.json({
      runtime: {
        id: runtime.id,
        modelSlug: runtime.model_slug,
        modelName: runtime.model_name,
        providerName: runtime.provider_name,
        status: runtime.status,
        endpointSlug: runtime.endpoint_slug,
        endpointPath: buildWorkspaceRuntimeEndpointPath(runtime.endpoint_slug),
        assistantPath: buildWorkspaceRuntimeAssistantPath(runtime.endpoint_slug),
        totalRequests: runtime.total_requests,
        totalTokens: runtime.total_tokens,
        lastUsedAt: runtime.last_used_at,
        updatedAt: runtime.updated_at,
        execution,
      },
    });
  } catch (error) {
    return handleApiError(error, "api/runtime/[endpointSlug]");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpointSlug: string }> }
) {
  try {
    const auth = await resolveAuthUser(request, ["agent"]);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const { data: runtime, error } = await admin
      .from("workspace_runtimes")
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (error || !runtime) {
      return NextResponse.json({ error: "Runtime not found" }, { status: 404 });
    }

    const execution = resolveWorkspaceRuntimeExecution(runtime.model_slug);
    if (!execution.available || !execution.provider || !execution.model) {
      return NextResponse.json(
        { error: execution.summary, runtime: { execution } },
        { status: 400 }
      );
    }

    const response = await callAgentModel({
      preferredProviders: [execution.provider],
      providerModels: {
        [execution.provider]: execution.model,
      },
      messages: [
        ...(parsed.data.system ? [{ role: "system" as const, content: parsed.data.system }] : []),
        { role: "user", content: parsed.data.message },
      ],
      temperature: 0.2,
      maxTokens: 2048,
    });

    const totalTokens = response.usage?.totalTokens ?? 0;

    await admin
      .from("workspace_runtimes")
      .update({
        total_requests: (runtime.total_requests ?? 0) + 1,
        total_tokens: Number(runtime.total_tokens ?? 0) + totalTokens,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", runtime.id);

    return NextResponse.json({
      response: {
        content: response.content,
        provider: response.provider,
        model: response.model,
        usage: response.usage,
      },
      runtime: {
        id: runtime.id,
        modelSlug: runtime.model_slug,
        modelName: runtime.model_name,
        providerName: runtime.provider_name,
        status: runtime.status,
        endpointSlug: runtime.endpoint_slug,
        endpointPath: buildWorkspaceRuntimeEndpointPath(runtime.endpoint_slug),
        assistantPath: buildWorkspaceRuntimeAssistantPath(runtime.endpoint_slug),
        totalRequests: (runtime.total_requests ?? 0) + 1,
        totalTokens: Number(runtime.total_tokens ?? 0) + totalTokens,
        lastUsedAt: new Date().toISOString(),
        updatedAt: runtime.updated_at,
        execution,
      },
    });
  } catch (error) {
    return handleApiError(error, "api/runtime/[endpointSlug]");
  }
}

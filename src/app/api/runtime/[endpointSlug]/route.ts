import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWorkspaceRuntimeAssistantPath,
  buildWorkspaceRuntimeEndpointPath,
} from "@/lib/workspace/runtime";

export const dynamic = "force-dynamic";

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
      },
    });
  } catch (error) {
    return handleApiError(error, "api/runtime/[endpointSlug]");
  }
}

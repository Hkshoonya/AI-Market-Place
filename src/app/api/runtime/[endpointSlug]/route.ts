import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWorkspaceRuntimeAssistantPath,
  buildWorkspaceRuntimeEndpointPath,
} from "@/lib/workspace/runtime";
import { buildWorkspaceDeploymentEndpointPath } from "@/lib/workspace/deployment";
import { resolveAvailableWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-availability";
import { rejectUntrustedSessionOrigin } from "@/lib/security/request-origin";

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

    const execution = await resolveAvailableWorkspaceRuntimeExecution(runtime.model_slug);

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

    const { data: deployment } = await admin
      .from("workspace_deployments")
      .select("endpoint_slug")
      .eq("user_id", auth.userId)
      .eq("runtime_id", runtime.id)
      .maybeSingle();
    const endpointPath = deployment?.endpoint_slug
      ? buildWorkspaceDeploymentEndpointPath(deployment.endpoint_slug)
      : null;

    return NextResponse.json(
      {
        error:
          "Direct runtime execution is read-only. Send model requests to the metered deployment endpoint so wallet balance, budget, usage, and refunds are enforced.",
        code: "metered_deployment_required",
        endpointPath,
        deploymentsPath: "/deployments",
      },
      { status: 409 }
    );
  } catch (error) {
    return handleApiError(error, "api/runtime/[endpointSlug]");
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import {
  buildWorkspaceRuntimeAssistantPath,
  buildWorkspaceRuntimeEndpointPath,
  buildWorkspaceRuntimeEndpointSlug,
} from "@/lib/workspace/runtime";
import {
  buildWorkspaceDeploymentEndpointPath,
  buildWorkspaceDeploymentEndpointSlug,
} from "@/lib/workspace/deployment";
import { getWorkspaceDeploymentBudgetSummary } from "@/lib/workspace/deployment-billing";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  modelSlug: z.string().trim().min(1).max(160),
  modelName: z.string().trim().min(1).max(200),
  providerName: z.string().trim().max(200).nullable().optional(),
  conversationId: z.string().trim().min(1).nullable().optional(),
  creditsBudget: z.number().finite().nonnegative().nullable().optional(),
  monthlyPriceEstimate: z.number().finite().nonnegative().nullable().optional(),
});

const UpdateSchema = z.object({
  modelSlug: z.string().trim().min(1).max(160),
  action: z.enum(["pause", "resume", "set_budget"]),
  creditsBudget: z.number().finite().nonnegative().nullable().optional(),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user };
}

function toRuntimeResponse(runtime: {
  id: string;
  model_slug: string;
  model_name: string;
  provider_name: string | null;
  status: string;
  endpoint_slug: string;
  total_requests: number;
  total_tokens: number;
  last_used_at: string | null;
  updated_at: string;
}) {
  return {
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
    execution: resolveWorkspaceRuntimeExecution(runtime.model_slug),
  };
}

function toDeploymentResponse(deployment: {
  id: string;
  runtime_id: string | null;
  model_slug: string;
  model_name: string;
  provider_name: string | null;
  status: "provisioning" | "ready" | "paused" | "failed";
  endpoint_slug: string;
  deployment_kind: "managed_api" | "assistant_only";
  deployment_label: string | null;
  credits_budget: number | null;
  monthly_price_estimate: number | null;
  total_requests: number;
  total_tokens: number;
  last_used_at: string | null;
  updated_at: string;
}) {
  return {
    id: deployment.id,
    runtimeId: deployment.runtime_id,
    modelSlug: deployment.model_slug,
    modelName: deployment.model_name,
    providerName: deployment.provider_name,
    status: deployment.status,
    endpointSlug: deployment.endpoint_slug,
    endpointPath: buildWorkspaceDeploymentEndpointPath(deployment.endpoint_slug),
    deploymentKind: deployment.deployment_kind,
    deploymentLabel: deployment.deployment_label,
    creditsBudget: deployment.credits_budget,
    monthlyPriceEstimate: deployment.monthly_price_estimate,
    totalRequests: deployment.total_requests,
    totalTokens: deployment.total_tokens,
    lastUsedAt: deployment.last_used_at,
    updatedAt: deployment.updated_at,
    execution: resolveWorkspaceRuntimeExecution(deployment.model_slug),
    billing: getWorkspaceDeploymentBudgetSummary({
      deploymentKind: deployment.deployment_kind,
      monthlyPriceEstimate: deployment.monthly_price_estimate,
      creditsBudget: deployment.credits_budget,
      totalRequests: deployment.total_requests,
    }),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const modelSlug = url.searchParams.get("modelSlug");
    if (!modelSlug) {
      return NextResponse.json({ deployment: null, runtime: null });
    }

    const { data: deployment, error: deploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.user.id)
      .eq("model_slug", modelSlug)
      .maybeSingle();

    if (deploymentError) throw deploymentError;

    let runtime = null;
    if (deployment?.runtime_id) {
      const { data: runtimeData, error: runtimeError } = await auth.supabase
        .from("workspace_runtimes")
        .select(
          "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
        )
        .eq("id", deployment.runtime_id)
        .maybeSingle();
      if (runtimeError) throw runtimeError;
      runtime = runtimeData ? toRuntimeResponse(runtimeData) : null;
    }

    return NextResponse.json({
      deployment: deployment ? toDeploymentResponse(deployment) : null,
      runtime,
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployment");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const execution = resolveWorkspaceRuntimeExecution(parsed.data.modelSlug);
    if (!execution.available) {
      return NextResponse.json(
        {
          error:
            "Direct in-site deployment is not available for this model yet. Use the verified provider path instead.",
          execution,
        },
        { status: 422 }
      );
    }

    const { data: existingRuntime, error: existingRuntimeError } = await auth.supabase
      .from("workspace_runtimes")
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.user.id)
      .eq("model_slug", parsed.data.modelSlug)
      .maybeSingle();
    if (existingRuntimeError) throw existingRuntimeError;

    const runtimePayload = {
      user_id: auth.user.id,
      model_slug: parsed.data.modelSlug,
      model_name: parsed.data.modelName,
      provider_name: parsed.data.providerName ?? null,
      workspace_conversation_id: parsed.data.conversationId ?? null,
      status: "ready" as const,
      endpoint_slug:
        existingRuntime?.endpoint_slug ?? buildWorkspaceRuntimeEndpointSlug(parsed.data.modelSlug),
    };

    const { data: runtimeData, error: runtimeUpsertError } = await auth.supabase
      .from("workspace_runtimes")
      .upsert(runtimePayload, { onConflict: "user_id,model_slug" })
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .single();
    if (runtimeUpsertError) throw runtimeUpsertError;

    const { data: existingDeployment, error: existingDeploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.user.id)
      .eq("model_slug", parsed.data.modelSlug)
      .maybeSingle();
    if (existingDeploymentError) throw existingDeploymentError;

    const deploymentPayload = {
      user_id: auth.user.id,
      runtime_id: runtimeData.id,
      model_slug: parsed.data.modelSlug,
      model_name: parsed.data.modelName,
      provider_name: parsed.data.providerName ?? null,
      status: "ready" as const,
      endpoint_slug:
        existingDeployment?.endpoint_slug ??
        buildWorkspaceDeploymentEndpointSlug(parsed.data.modelSlug),
      deployment_kind: "managed_api" as const,
      deployment_label: execution.label,
      credits_budget: parsed.data.creditsBudget ?? null,
      monthly_price_estimate: parsed.data.monthlyPriceEstimate ?? null,
    };

    const { data: deploymentData, error: deploymentUpsertError } = await auth.supabase
      .from("workspace_deployments")
      .upsert(deploymentPayload, { onConflict: "user_id,model_slug" })
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, total_tokens, last_used_at, updated_at"
      )
      .single();
    if (deploymentUpsertError) throw deploymentUpsertError;

    return NextResponse.json({
      deployment: toDeploymentResponse(deploymentData),
      runtime: toRuntimeResponse(runtimeData),
      activation: {
        message:
          "Deployment created inside AI Market Cap. This model now has a managed in-site endpoint you can use from the workspace.",
      },
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployment");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const parsed = UpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { data: deployment, error: deploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.user.id)
      .eq("model_slug", parsed.data.modelSlug)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const execution = resolveWorkspaceRuntimeExecution(deployment.model_slug);
    const updatePayload: {
      status?: "ready" | "paused";
      credits_budget?: number | null;
    } = {};

    if (parsed.data.action === "pause") {
      updatePayload.status = "paused";
    }

    if (parsed.data.action === "resume") {
      if (!execution.available) {
        return NextResponse.json(
          {
            error:
              "This deployment cannot be resumed because the model no longer has a mapped in-site runtime.",
          },
          { status: 422 }
        );
      }
      updatePayload.status = "ready";
    }

    if (parsed.data.action === "set_budget") {
      updatePayload.credits_budget = parsed.data.creditsBudget ?? null;
    }

    const { data: updatedDeployment, error: updateError } = await auth.supabase
      .from("workspace_deployments")
      .update(updatePayload)
      .eq("id", deployment.id)
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, total_tokens, last_used_at, updated_at"
      )
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      deployment: toDeploymentResponse(updatedDeployment),
      update: {
        action: parsed.data.action,
        message:
          parsed.data.action === "pause"
            ? "Deployment paused."
            : parsed.data.action === "resume"
              ? "Deployment resumed."
              : "Deployment budget updated.",
      },
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployment");
  }
}

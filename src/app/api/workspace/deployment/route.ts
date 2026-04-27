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
  buildWorkspaceDeploymentEndpointSlug,
} from "@/lib/workspace/deployment";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import {
  toWorkspaceDeploymentResponse,
  type WorkspaceDeploymentRecord,
} from "@/lib/workspace/deployment-summary";
import {
  deleteHostedDeployment,
  provisionHuggingFaceDeployment,
  provisionReplicateDeployment,
  refreshHostedDeploymentStatus,
  resolveWorkspaceProvisioningOption,
  updateHostedDeploymentScale,
} from "@/lib/workspace/external-deployment";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

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

const DeleteSchema = z.object({
  modelSlug: z.string().trim().min(1).max(160),
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

const DEPLOYMENT_SELECT =
  "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, external_platform_slug, external_provider, external_owner, external_name, external_model_ref, external_web_url, credits_budget, monthly_price_estimate, total_requests, successful_requests, failed_requests, total_tokens, avg_response_latency_ms, last_response_latency_ms, last_used_at, last_success_at, last_error_at, last_error_message, updated_at";

async function reconcileHostedDeployment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  deployment: WorkspaceDeploymentRecord | null
) {
  if (!deployment || deployment.deployment_kind !== "hosted_external") {
    return deployment;
  }

  const snapshot = await refreshHostedDeploymentStatus({
    provider: deployment.external_provider,
    owner: deployment.external_owner,
    name: deployment.external_name,
  });

  if (!snapshot) return deployment;

  const needsUpdate =
    deployment.status !== snapshot.status ||
    deployment.external_web_url !== snapshot.externalWebUrl ||
    deployment.external_model_ref !== snapshot.externalModelRef ||
    (deployment.last_error_message ?? null) !== snapshot.errorMessage;

  if (!needsUpdate) return deployment;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("workspace_deployments")
    .update({
      status: snapshot.status,
      external_web_url: snapshot.externalWebUrl,
      external_model_ref: snapshot.externalModelRef,
      last_error_at: snapshot.errorMessage ? nowIso : null,
      last_error_message: snapshot.errorMessage,
    })
    .eq("id", deployment.id)
    .select(DEPLOYMENT_SELECT)
    .single();

  if (error) throw error;
  return data as WorkspaceDeploymentRecord;
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const modelSlug = url.searchParams.get("modelSlug");
    if (!modelSlug) {
      return NextResponse.json({ deployment: null, runtime: null, provisioning: null });
    }

    const provisioning = await resolveWorkspaceProvisioningOption({
      supabase: auth.supabase,
      modelSlug,
      runtimeExecution: resolveWorkspaceRuntimeExecution(modelSlug),
    });

    const { data: deployment, error: deploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
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

    const reconciledDeployment = deployment
      ? await reconcileHostedDeployment(auth.supabase, deployment as WorkspaceDeploymentRecord)
      : null;

    return NextResponse.json({
      deployment: reconciledDeployment
        ? toWorkspaceDeploymentResponse(reconciledDeployment)
        : null,
      runtime,
      provisioning,
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployment");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

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

    const execution = resolveWorkspaceRuntimeExecution(parsed.data.modelSlug);
    const provisioning = await resolveWorkspaceProvisioningOption({
      supabase: auth.supabase,
      modelSlug: parsed.data.modelSlug,
      runtimeExecution: execution,
    });
    if (!provisioning.canCreate) {
      return NextResponse.json(
        {
          error:
            "A one-click deployment is not available for this model yet. Use the verified provider path instead.",
          execution,
          provisioning,
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

    let runtimeData: {
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
    } | null = null;

    if (provisioning.deploymentKind === "managed_api") {
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

      const runtimeUpsertResult = await auth.supabase
        .from("workspace_runtimes")
        .upsert(runtimePayload, { onConflict: "user_id,model_slug" })
        .select(
          "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
        )
        .single();
      if (runtimeUpsertResult.error) throw runtimeUpsertResult.error;
      runtimeData = runtimeUpsertResult.data;
    }

    const { data: existingDeployment, error: existingDeploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
      .eq("user_id", auth.user.id)
      .eq("model_slug", parsed.data.modelSlug)
      .maybeSingle();
    if (existingDeploymentError) throw existingDeploymentError;

    let externalFields = {
      external_platform_slug: existingDeployment?.external_platform_slug ?? null,
      external_provider: existingDeployment?.external_provider ?? null,
      external_owner: existingDeployment?.external_owner ?? null,
      external_name: existingDeployment?.external_name ?? null,
      external_model_ref: existingDeployment?.external_model_ref ?? null,
      external_web_url: existingDeployment?.external_web_url ?? null,
    };

    if (
      provisioning.deploymentKind === "hosted_external" &&
      provisioning.target?.provider === "replicate" &&
      !externalFields.external_owner
    ) {
      const { data: modelMetadata, error: modelMetadataError } = await auth.supabase
        .from("models")
        .select("category, parameter_count")
        .eq("slug", parsed.data.modelSlug)
        .single();
      if (modelMetadataError) throw modelMetadataError;

      externalFields = await provisionReplicateDeployment({
        target: provisioning.target,
        modelSlug: parsed.data.modelSlug,
        category: modelMetadata?.category ?? null,
        parameterCount: modelMetadata?.parameter_count ?? null,
      });
    }

    if (
      provisioning.deploymentKind === "hosted_external" &&
      provisioning.target?.provider === "huggingface" &&
      !externalFields.external_owner
    ) {
      externalFields = await provisionHuggingFaceDeployment({
        target: provisioning.target,
      });
    }

    let deploymentStatus: "ready" | "provisioning" = "ready";
    if (
      provisioning.deploymentKind === "hosted_external" &&
      externalFields.external_provider &&
      externalFields.external_owner &&
      externalFields.external_name
    ) {
      const snapshot = await refreshHostedDeploymentStatus({
        provider: externalFields.external_provider,
        owner: externalFields.external_owner,
        name: externalFields.external_name,
      });
      if (snapshot) {
        deploymentStatus = snapshot.status === "ready" ? "ready" : "provisioning";
        externalFields = {
          ...externalFields,
          external_web_url: snapshot.externalWebUrl,
          external_model_ref:
            snapshot.externalModelRef ?? externalFields.external_model_ref,
        };
      } else {
        deploymentStatus = "provisioning";
      }
    }

    const deploymentPayload = {
      user_id: auth.user.id,
      runtime_id: runtimeData?.id ?? null,
      model_slug: parsed.data.modelSlug,
      model_name: parsed.data.modelName,
      provider_name: parsed.data.providerName ?? null,
      status: deploymentStatus,
      endpoint_slug:
        existingDeployment?.endpoint_slug ??
        buildWorkspaceDeploymentEndpointSlug(parsed.data.modelSlug),
      deployment_kind: provisioning.deploymentKind,
      deployment_label: provisioning.label,
      ...externalFields,
      credits_budget: parsed.data.creditsBudget ?? null,
      monthly_price_estimate: parsed.data.monthlyPriceEstimate ?? null,
    };

    const { data: deploymentData, error: deploymentUpsertError } = await auth.supabase
      .from("workspace_deployments")
      .upsert(deploymentPayload, { onConflict: "user_id,model_slug" })
      .select(DEPLOYMENT_SELECT)
      .single();
    if (deploymentUpsertError) throw deploymentUpsertError;

    await auth.supabase.from("workspace_deployment_events").insert({
      deployment_id: deploymentData.id,
      user_id: auth.user.id,
      event_type: "deployment_created",
      provider_name: parsed.data.providerName ?? null,
      model_name: parsed.data.modelName,
    });

    return NextResponse.json({
      deployment: toWorkspaceDeploymentResponse(deploymentData as WorkspaceDeploymentRecord),
      runtime: runtimeData ? toRuntimeResponse(runtimeData) : null,
      activation: {
        message:
          provisioning.deploymentKind === "hosted_external"
            ? deploymentStatus === "ready"
              ? "Hosted deployment connected through AI Market Cap. You can now use it through the AI Market Cap endpoint."
              : "AI Market Cap started the hosted deployment. It is still provisioning and will become usable here once the backend is ready."
            : "Deployment created inside AI Market Cap. This model now has a managed in-site endpoint you can use from the workspace.",
      },
      provisioning,
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployment");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    const parsed = UpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { data: deployment, error: deploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
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
      if (deployment.deployment_kind === "hosted_external") {
        await updateHostedDeploymentScale({
          provider: deployment.external_provider,
          owner: deployment.external_owner,
          name: deployment.external_name,
          minInstances: 0,
          maxInstances: 0,
        });
      }
      updatePayload.status = "paused";
    }

    if (parsed.data.action === "resume") {
      if (deployment.deployment_kind === "managed_api" && !execution.available) {
        return NextResponse.json(
          {
            error:
              "This deployment cannot be resumed because the model no longer has a mapped in-site runtime.",
          },
          { status: 422 }
        );
      }
      if (deployment.deployment_kind === "hosted_external") {
        await updateHostedDeploymentScale({
          provider: deployment.external_provider,
          owner: deployment.external_owner,
          name: deployment.external_name,
          minInstances: 0,
          maxInstances: 1,
        });
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
      .select(DEPLOYMENT_SELECT)
      .single();

    if (updateError) throw updateError;

    await auth.supabase.from("workspace_deployment_events").insert({
      deployment_id: updatedDeployment.id,
      user_id: auth.user.id,
      event_type:
        parsed.data.action === "pause"
          ? "deployment_paused"
          : parsed.data.action === "resume"
            ? "deployment_resumed"
            : "budget_updated",
      provider_name: updatedDeployment.provider_name,
      model_name: updatedDeployment.model_name,
      charge_amount:
        parsed.data.action === "set_budget" ? updatedDeployment.credits_budget ?? null : null,
    });

    return NextResponse.json({
      deployment: toWorkspaceDeploymentResponse(
        updatedDeployment as WorkspaceDeploymentRecord
      ),
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

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    const parsed = DeleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { data: deployment, error: deploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
      .eq("user_id", auth.user.id)
      .eq("model_slug", parsed.data.modelSlug)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (deployment.deployment_kind === "hosted_external") {
      await deleteHostedDeployment({
        provider: deployment.external_provider,
        owner: deployment.external_owner,
        name: deployment.external_name,
      });
    }

    const { error: deleteDeploymentError } = await auth.supabase
      .from("workspace_deployments")
      .delete()
      .eq("id", deployment.id);
    if (deleteDeploymentError) throw deleteDeploymentError;

    if (deployment.runtime_id) {
      const { error: deleteRuntimeError } = await auth.supabase
        .from("workspace_runtimes")
        .delete()
        .eq("id", deployment.runtime_id)
        .eq("user_id", auth.user.id);
      if (deleteRuntimeError) throw deleteRuntimeError;
    }

    return NextResponse.json({
      removed: true,
      modelSlug: deployment.model_slug,
      message: "Deployment removed from AI Market Cap.",
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployment");
  }
}

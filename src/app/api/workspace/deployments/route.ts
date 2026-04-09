import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import {
  toWorkspaceDeploymentResponse,
  type WorkspaceDeploymentRecord,
} from "@/lib/workspace/deployment-summary";
import { refreshHostedDeploymentStatus } from "@/lib/workspace/external-deployment";

export const dynamic = "force-dynamic";

const DEPLOYMENT_SELECT =
  "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, external_platform_slug, external_provider, external_owner, external_name, external_model_ref, external_web_url, credits_budget, monthly_price_estimate, total_requests, successful_requests, failed_requests, total_tokens, avg_response_latency_ms, last_response_latency_ms, last_used_at, last_success_at, last_error_at, last_error_message, updated_at";

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

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const reconciledDeployments = await Promise.all(
      ((data ?? []) as WorkspaceDeploymentRecord[]).map(async (deployment) => {
        if (deployment.deployment_kind !== "hosted_external") {
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
        const { data: updated, error: updateError } = await auth.supabase
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

        if (updateError) throw updateError;
        return updated as WorkspaceDeploymentRecord;
      })
    );

    return NextResponse.json({
      deployments: reconciledDeployments.map(
        toWorkspaceDeploymentResponse
      ),
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployments");
  }
}

import { refreshHostedDeploymentStatus } from "@/lib/workspace/external-deployment";
import type { WorkspaceDeploymentRecord } from "@/lib/workspace/deployment-summary";

const DEPLOYMENT_SELECT =
  "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, external_platform_slug, external_provider, external_owner, external_name, external_model_ref, external_web_url, credits_budget, monthly_price_estimate, total_requests, successful_requests, failed_requests, total_tokens, avg_response_latency_ms, last_response_latency_ms, last_used_at, last_success_at, last_error_at, last_error_message, updated_at";

type AdminLike = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => {
          limit: (limit: number) => Promise<{ data: WorkspaceDeploymentRecord[] | null; error: { message: string } | null }>;
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        select: (query: string) => {
          single: () => Promise<{ data: WorkspaceDeploymentRecord | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

export async function reconcileHostedDeployments(
  admin: AdminLike,
  limit = 100
) {
  const { data, error } = await admin
    .from("workspace_deployments")
    .select(DEPLOYMENT_SELECT)
    .eq("deployment_kind", "hosted_external")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load hosted deployments: ${error.message}`);
  }

  const deployments = data ?? [];
  const results = {
    scanned: deployments.length,
    updated: 0,
    unchanged: 0,
    errors: [] as Array<{ id: string; slug: string; error: string }>,
  };

  for (const deployment of deployments) {
    try {
      const snapshot = await refreshHostedDeploymentStatus({
        provider: deployment.external_provider,
        owner: deployment.external_owner,
        name: deployment.external_name,
      });

      if (!snapshot) {
        results.unchanged += 1;
        continue;
      }

      const needsUpdate =
        deployment.status !== snapshot.status ||
        deployment.external_web_url !== snapshot.externalWebUrl ||
        deployment.external_model_ref !== snapshot.externalModelRef ||
        (deployment.last_error_message ?? null) !== snapshot.errorMessage;

      if (!needsUpdate) {
        results.unchanged += 1;
        continue;
      }

      const nowIso = new Date().toISOString();
      const { error: updateError } = await admin
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

      if (updateError) {
        throw new Error(updateError.message);
      }

      results.updated += 1;
    } catch (error) {
      results.errors.push({
        id: deployment.id,
        slug: deployment.model_slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

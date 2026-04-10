import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAgentModel } from "@/lib/agents/provider-router";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { buildWorkspaceDeploymentEndpointPath } from "@/lib/workspace/deployment";
import {
  refreshHostedDeploymentStatus,
  runHuggingFaceDeployment,
  runReplicateDeployment,
} from "@/lib/workspace/external-deployment";
import { type WorkspaceDeploymentRecord } from "@/lib/workspace/deployment-summary";
import {
  getWorkspaceDeploymentBudgetSummary,
  getWorkspaceDeploymentRequestCharge,
} from "@/lib/workspace/deployment-billing";
import { creditWallet, debitWallet, getWalletByOwner } from "@/lib/payments/wallet";

export const dynamic = "force-dynamic";

const DEPLOYMENT_SELECT =
  "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, external_platform_slug, external_provider, external_owner, external_name, external_model_ref, external_web_url, credits_budget, monthly_price_estimate, total_requests, successful_requests, failed_requests, total_tokens, avg_response_latency_ms, last_response_latency_ms, last_used_at, last_success_at, last_error_at, last_error_message, updated_at";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  system: z.string().trim().max(4000).optional(),
});

async function reconcileHostedDeployment(
  admin: ReturnType<typeof createAdminClient>,
  deployment: WorkspaceDeploymentRecord
): Promise<WorkspaceDeploymentRecord> {
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
  const { data, error } = await admin
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

  if (error || !data) {
    throw error ?? new Error("Failed to reconcile hosted deployment");
  }

  return data as WorkspaceDeploymentRecord;
}

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
    const { data: deployment, error } = await admin
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (error || !deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const reconciledDeployment = await reconcileHostedDeployment(
      admin,
      deployment as WorkspaceDeploymentRecord
    );

    return NextResponse.json({
      deployment: {
        id: reconciledDeployment.id,
        runtimeId: reconciledDeployment.runtime_id,
        modelSlug: reconciledDeployment.model_slug,
        modelName: reconciledDeployment.model_name,
        providerName: reconciledDeployment.provider_name,
        status: reconciledDeployment.status,
        endpointSlug: reconciledDeployment.endpoint_slug,
        endpointPath: buildWorkspaceDeploymentEndpointPath(reconciledDeployment.endpoint_slug),
        deploymentKind: reconciledDeployment.deployment_kind,
        deploymentLabel: reconciledDeployment.deployment_label,
        target:
          reconciledDeployment.external_platform_slug && reconciledDeployment.external_provider
            ? {
                platformSlug: reconciledDeployment.external_platform_slug,
                provider: reconciledDeployment.external_provider,
                owner: reconciledDeployment.external_owner,
                name: reconciledDeployment.external_name,
                modelRef: reconciledDeployment.external_model_ref,
                webUrl: reconciledDeployment.external_web_url,
              }
            : null,
        creditsBudget: reconciledDeployment.credits_budget,
        monthlyPriceEstimate: reconciledDeployment.monthly_price_estimate,
        totalRequests: reconciledDeployment.total_requests,
        totalTokens: reconciledDeployment.total_tokens,
        lastUsedAt: reconciledDeployment.last_used_at,
        updatedAt: reconciledDeployment.updated_at,
        execution: resolveWorkspaceRuntimeExecution(reconciledDeployment.model_slug),
        billing: getWorkspaceDeploymentBudgetSummary({
          deploymentKind: reconciledDeployment.deployment_kind,
          monthlyPriceEstimate: reconciledDeployment.monthly_price_estimate,
          creditsBudget: reconciledDeployment.credits_budget,
          totalRequests: reconciledDeployment.total_requests,
        }),
      },
    });
  } catch (error) {
    return handleApiError(error, "api/deployments/[endpointSlug]");
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
    const { data: deployment, error } = await admin
      .from("workspace_deployments")
      .select(DEPLOYMENT_SELECT)
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (error || !deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const reconciledDeployment = await reconcileHostedDeployment(
      admin,
      deployment as WorkspaceDeploymentRecord
    );

    const execution = resolveWorkspaceRuntimeExecution(reconciledDeployment.model_slug);
    const billing = getWorkspaceDeploymentBudgetSummary({
      deploymentKind: reconciledDeployment.deployment_kind,
      monthlyPriceEstimate: reconciledDeployment.monthly_price_estimate,
      creditsBudget: reconciledDeployment.credits_budget,
      totalRequests: reconciledDeployment.total_requests,
    });

    if (reconciledDeployment.status === "paused") {
      return NextResponse.json(
        {
          error: "This deployment is paused. Resume it before sending more model requests.",
          deployment: {
            status: reconciledDeployment.status,
            execution,
            billing,
          },
        },
        { status: 409 }
      );
    }

    if (reconciledDeployment.status !== "ready") {
      return NextResponse.json(
        {
          error: execution.summary,
          deployment: { status: reconciledDeployment.status, execution, billing },
        },
        { status: 400 }
      );
    }

    const requestCharge = getWorkspaceDeploymentRequestCharge({
      deploymentKind: reconciledDeployment.deployment_kind,
      monthlyPriceEstimate: reconciledDeployment.monthly_price_estimate,
    });

    if (
      billing.budgetRemaining != null &&
      requestCharge > 0 &&
      billing.budgetRemaining < requestCharge
    ) {
      return NextResponse.json(
        {
          error: `Deployment budget exhausted. Required: $${requestCharge.toFixed(2)}, Remaining: $${billing.budgetRemaining.toFixed(2)}`,
          deployment: {
            status: reconciledDeployment.status,
            execution,
            billing,
          },
        },
        { status: 402 }
      );
    }

    let chargeTxId: string | null = null;
    if (requestCharge > 0) {
      const wallet = await getWalletByOwner(auth.userId);
      if (!wallet) {
        return NextResponse.json(
          { error: "No wallet found. Create and fund a wallet before using this deployment." },
          { status: 402 }
        );
      }

      if (Number(wallet.balance) < requestCharge) {
        return NextResponse.json(
          {
            error: `Insufficient balance. Required: $${requestCharge.toFixed(2)}, Available: $${Number(wallet.balance).toFixed(2)}`,
          },
          { status: 402 }
        );
      }

      chargeTxId = await debitWallet(wallet.id, requestCharge, "api_charge", {
        referenceType: "workspace_deployment_request",
        referenceId: reconciledDeployment.id,
        description: `Workspace deployment request for ${reconciledDeployment.model_name}`,
      });
    }

    const startedAt = Date.now();
    let response;
    try {
      if (reconciledDeployment.deployment_kind === "hosted_external") {
        if (
          !reconciledDeployment.external_provider ||
          !reconciledDeployment.external_owner ||
          !reconciledDeployment.external_name ||
          !reconciledDeployment.external_model_ref
        ) {
          throw new Error("Hosted deployment target is incomplete");
        }
        response =
          reconciledDeployment.external_provider === "huggingface"
            ? await runHuggingFaceDeployment({
                modelRef: reconciledDeployment.external_model_ref,
                message: parsed.data.message,
                system: parsed.data.system,
              })
            : await runReplicateDeployment({
                owner: reconciledDeployment.external_owner,
                name: reconciledDeployment.external_name,
                modelRef: reconciledDeployment.external_model_ref,
                message: parsed.data.message,
                system: parsed.data.system,
              });
      } else {
        if (!execution.available || !execution.provider || !execution.model) {
          throw new Error(execution.summary);
        }
        response = await callAgentModel({
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
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to run deployment request";
      const durationMs = Date.now() - startedAt;

      await admin
        .from("workspace_deployments")
        .update({
          status: "failed",
          failed_requests: (reconciledDeployment.failed_requests ?? 0) + 1,
          last_response_latency_ms: durationMs,
          last_error_at: new Date().toISOString(),
          last_error_message: errorMessage,
        })
        .eq("id", reconciledDeployment.id);

      await admin.from("workspace_deployment_events").insert({
        deployment_id: reconciledDeployment.id,
        user_id: auth.userId,
        event_type: "request_failed",
        request_message: parsed.data.message.slice(0, 1000),
        provider_name: reconciledDeployment.provider_name,
        model_name: reconciledDeployment.model_name,
        charge_amount: requestCharge > 0 ? requestCharge : null,
        duration_ms: durationMs,
        error_message: errorMessage,
      });

      if (chargeTxId && requestCharge > 0) {
        const wallet = await getWalletByOwner(auth.userId);
        if (wallet) {
          await creditWallet(wallet.id, requestCharge, "refund", {
            referenceType: "workspace_deployment_refund",
            referenceId: reconciledDeployment.id,
            description: `Refund for failed workspace deployment request on ${reconciledDeployment.model_name}`,
          });
        }
      }
      throw error;
    }

    const totalTokens = response.usage?.totalTokens ?? 0;
    const nowIso = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const previousSuccesses = reconciledDeployment.successful_requests ?? 0;
    const previousAvgLatency = reconciledDeployment.avg_response_latency_ms ?? 0;
    const nextSuccessfulRequests = previousSuccesses + 1;
    const nextAvgLatency =
      nextSuccessfulRequests > 0
        ? Math.round(
            ((previousAvgLatency * previousSuccesses) + durationMs) / nextSuccessfulRequests
          )
        : durationMs;

    await admin
      .from("workspace_deployments")
      .update({
        status: "ready",
        total_requests: (reconciledDeployment.total_requests ?? 0) + 1,
        successful_requests: nextSuccessfulRequests,
        total_tokens: Number(reconciledDeployment.total_tokens ?? 0) + totalTokens,
        avg_response_latency_ms: nextAvgLatency,
        last_response_latency_ms: durationMs,
        last_used_at: nowIso,
        last_success_at: nowIso,
        last_error_at: null,
        last_error_message: null,
      })
      .eq("id", reconciledDeployment.id);

    await admin.from("workspace_deployment_events").insert({
      deployment_id: reconciledDeployment.id,
      user_id: auth.userId,
      event_type: "request_succeeded",
      request_message: parsed.data.message.slice(0, 1000),
      response_preview: response.content.slice(0, 1000),
      provider_name: response.provider,
      model_name: response.model,
      tokens_used: totalTokens,
      charge_amount: requestCharge > 0 ? requestCharge : null,
      duration_ms: durationMs,
    });

    if (reconciledDeployment.runtime_id) {
      const { data: runtime } = await admin
        .from("workspace_runtimes")
        .select("id, total_requests, total_tokens")
        .eq("id", reconciledDeployment.runtime_id)
        .single();

      if (runtime) {
        await admin
          .from("workspace_runtimes")
          .update({
            total_requests: (runtime.total_requests ?? 0) + 1,
            total_tokens: Number(runtime.total_tokens ?? 0) + totalTokens,
            last_used_at: nowIso,
          })
          .eq("id", runtime.id);
      }
    }

    return NextResponse.json({
      response: {
        content: response.content,
        provider: response.provider,
        model: response.model,
        usage: response.usage,
      },
      deployment: {
        id: reconciledDeployment.id,
        endpointPath: buildWorkspaceDeploymentEndpointPath(reconciledDeployment.endpoint_slug),
        status: "ready",
        deploymentLabel: reconciledDeployment.deployment_label,
        requestCharge,
        totalRequests: (reconciledDeployment.total_requests ?? 0) + 1,
        totalTokens: Number(reconciledDeployment.total_tokens ?? 0) + totalTokens,
        lastUsedAt: nowIso,
        execution,
        billing: getWorkspaceDeploymentBudgetSummary({
          deploymentKind: reconciledDeployment.deployment_kind,
          monthlyPriceEstimate: reconciledDeployment.monthly_price_estimate,
          creditsBudget: reconciledDeployment.credits_budget,
          totalRequests: (reconciledDeployment.total_requests ?? 0) + 1,
        }),
      },
    });
  } catch (error) {
    return handleApiError(error, "api/deployments/[endpointSlug]");
  }
}

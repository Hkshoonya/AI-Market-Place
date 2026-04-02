import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAgentModel } from "@/lib/agents/provider-router";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { buildWorkspaceDeploymentEndpointPath } from "@/lib/workspace/deployment";
import {
  getWorkspaceDeploymentBudgetSummary,
  getWorkspaceDeploymentRequestCharge,
} from "@/lib/workspace/deployment-billing";
import { creditWallet, debitWallet, getWalletByOwner } from "@/lib/payments/wallet";

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
    const { data: deployment, error } = await admin
      .from("workspace_deployments")
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, successful_requests, failed_requests, total_tokens, avg_response_latency_ms, last_response_latency_ms, last_used_at, last_success_at, last_error_at, last_error_message, updated_at"
      )
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (error || !deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    return NextResponse.json({
      deployment: {
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
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, successful_requests, failed_requests, total_tokens, avg_response_latency_ms, last_response_latency_ms, last_used_at, last_success_at, last_error_at, last_error_message, updated_at"
      )
      .eq("user_id", auth.userId)
      .eq("endpoint_slug", endpointSlug)
      .single();

    if (error || !deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const execution = resolveWorkspaceRuntimeExecution(deployment.model_slug);
    const billing = getWorkspaceDeploymentBudgetSummary({
      deploymentKind: deployment.deployment_kind,
      monthlyPriceEstimate: deployment.monthly_price_estimate,
      creditsBudget: deployment.credits_budget,
      totalRequests: deployment.total_requests,
    });

    if (deployment.status === "paused") {
      return NextResponse.json(
        {
          error: "This deployment is paused. Resume it before sending more model requests.",
          deployment: {
            status: deployment.status,
            execution,
            billing,
          },
        },
        { status: 409 }
      );
    }

    if (deployment.status !== "ready" || !execution.available || !execution.provider || !execution.model) {
      return NextResponse.json(
        { error: execution.summary, deployment: { status: deployment.status, execution, billing } },
        { status: 400 }
      );
    }

    const requestCharge = getWorkspaceDeploymentRequestCharge({
      deploymentKind: deployment.deployment_kind,
      monthlyPriceEstimate: deployment.monthly_price_estimate,
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
            status: deployment.status,
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
        referenceId: deployment.id,
        description: `Workspace deployment request for ${deployment.model_name}`,
      });
    }

    const startedAt = Date.now();
    let response;
    try {
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to run deployment request";
      const durationMs = Date.now() - startedAt;

      await admin
        .from("workspace_deployments")
        .update({
          status: "failed",
          failed_requests: (deployment.failed_requests ?? 0) + 1,
          last_response_latency_ms: durationMs,
          last_error_at: new Date().toISOString(),
          last_error_message: errorMessage,
        })
        .eq("id", deployment.id);

      await admin.from("workspace_deployment_events").insert({
        deployment_id: deployment.id,
        user_id: auth.userId,
        event_type: "request_failed",
        request_message: parsed.data.message.slice(0, 1000),
        provider_name: deployment.provider_name,
        model_name: deployment.model_name,
        charge_amount: requestCharge > 0 ? requestCharge : null,
        duration_ms: durationMs,
        error_message: errorMessage,
      });

      if (chargeTxId && requestCharge > 0) {
        const wallet = await getWalletByOwner(auth.userId);
        if (wallet) {
          await creditWallet(wallet.id, requestCharge, "refund", {
            referenceType: "workspace_deployment_refund",
            referenceId: deployment.id,
            description: `Refund for failed workspace deployment request on ${deployment.model_name}`,
          });
        }
      }
      throw error;
    }

    const totalTokens = response.usage?.totalTokens ?? 0;
    const nowIso = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const previousSuccesses = deployment.successful_requests ?? 0;
    const previousAvgLatency = deployment.avg_response_latency_ms ?? 0;
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
        total_requests: (deployment.total_requests ?? 0) + 1,
        successful_requests: nextSuccessfulRequests,
        total_tokens: Number(deployment.total_tokens ?? 0) + totalTokens,
        avg_response_latency_ms: nextAvgLatency,
        last_response_latency_ms: durationMs,
        last_used_at: nowIso,
        last_success_at: nowIso,
        last_error_at: null,
        last_error_message: null,
      })
      .eq("id", deployment.id);

    await admin.from("workspace_deployment_events").insert({
      deployment_id: deployment.id,
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

    if (deployment.runtime_id) {
      const { data: runtime } = await admin
        .from("workspace_runtimes")
        .select("id, total_requests, total_tokens")
        .eq("id", deployment.runtime_id)
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
        id: deployment.id,
        endpointPath: buildWorkspaceDeploymentEndpointPath(deployment.endpoint_slug),
        status: deployment.status,
        deploymentLabel: deployment.deployment_label,
        requestCharge,
        totalRequests: (deployment.total_requests ?? 0) + 1,
        totalTokens: Number(deployment.total_tokens ?? 0) + totalTokens,
        lastUsedAt: nowIso,
        execution,
        billing: getWorkspaceDeploymentBudgetSummary({
          deploymentKind: deployment.deployment_kind,
          monthlyPriceEstimate: deployment.monthly_price_estimate,
          creditsBudget: deployment.credits_budget,
          totalRequests: (deployment.total_requests ?? 0) + 1,
        }),
      },
    });
  } catch (error) {
    return handleApiError(error, "api/deployments/[endpointSlug]");
  }
}

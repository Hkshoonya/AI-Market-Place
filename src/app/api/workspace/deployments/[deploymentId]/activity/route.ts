import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { getWalletByOwner, getTransactionHistory } from "@/lib/payments/wallet";

export const dynamic = "force-dynamic";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const { deploymentId } = await params;
    const { data: deployment, error: deploymentError } = await auth.supabase
      .from("workspace_deployments")
      .select("id")
      .eq("id", deploymentId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (deploymentError) throw deploymentError;
    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const wallet = await getWalletByOwner(auth.user.id);
    if (!wallet) {
      return NextResponse.json({ activity: [] });
    }

    const [charges, refunds, eventsResponse] = await Promise.all([
      getTransactionHistory(wallet.id, {
        limit: 20,
        referenceType: "workspace_deployment_request",
        referenceId: deploymentId,
      }),
      getTransactionHistory(wallet.id, {
        limit: 20,
        referenceType: "workspace_deployment_refund",
        referenceId: deploymentId,
      }),
      auth.supabase
        .from("workspace_deployment_events")
        .select(
          "id, event_type, request_message, response_preview, provider_name, model_name, tokens_used, charge_amount, duration_ms, error_message, created_at"
        )
        .eq("deployment_id", deploymentId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (eventsResponse.error) throw eventsResponse.error;

    const activity = [...charges, ...refunds]
      .sort((a, b) => {
        const left = new Date(a.created_at ?? 0).getTime();
        const right = new Date(b.created_at ?? 0).getTime();
        return right - left;
      })
      .slice(0, 30)
      .map((item) => ({
        id: item.id,
        type: item.type,
        amount: Number(item.amount ?? 0),
        description: item.description ?? null,
        referenceType: item.reference_type ?? null,
        status: item.status,
        createdAt: item.created_at,
      }));

    const events = (eventsResponse.data ?? []).map((item) => ({
      id: item.id,
      eventType: item.event_type,
      requestMessage: item.request_message,
      responsePreview: item.response_preview,
      providerName: item.provider_name,
      modelName: item.model_name,
      tokensUsed: item.tokens_used,
      chargeAmount: item.charge_amount != null ? Number(item.charge_amount) : null,
      durationMs: item.duration_ms,
      errorMessage: item.error_message,
      createdAt: item.created_at,
    }));

    return NextResponse.json({ activity, events });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployments/[deploymentId]/activity");
  }
}

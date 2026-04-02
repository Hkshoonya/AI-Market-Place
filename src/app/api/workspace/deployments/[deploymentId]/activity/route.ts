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

    const [charges, refunds] = await Promise.all([
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
    ]);

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

    return NextResponse.json({ activity });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployments/[deploymentId]/activity");
  }
}

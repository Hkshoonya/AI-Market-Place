import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import {
  toWorkspaceDeploymentResponse,
  type WorkspaceDeploymentRecord,
} from "@/lib/workspace/deployment-summary";

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

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("workspace_deployments")
      .select(
        "id, runtime_id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, deployment_label, credits_budget, monthly_price_estimate, total_requests, total_tokens, last_used_at, last_success_at, last_error_at, last_error_message, updated_at"
      )
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      deployments: ((data ?? []) as WorkspaceDeploymentRecord[]).map(
        toWorkspaceDeploymentResponse
      ),
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/deployments");
  }
}

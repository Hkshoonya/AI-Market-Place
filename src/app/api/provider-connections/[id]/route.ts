import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsedId = IdSchema.safeParse((await params).id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid connection id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { count, error: deploymentError } = await admin
      .from("workspace_deployments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("provider_connection_id", parsedId.data);
    if (deploymentError) throw deploymentError;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Delete deployments using this provider connection before disconnecting it.",
        },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from("provider_connections")
      .delete()
      .eq("id", parsedId.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "api/provider-connections/[id]");
  }
}

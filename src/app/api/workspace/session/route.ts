import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { normalizeWorkspaceState } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  workspace: z.unknown().nullable(),
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

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("workspace_sessions")
      .select("workspace_state")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const workspace = normalizeWorkspaceState(data?.workspace_state ?? null);
    return NextResponse.json({ workspace });
  } catch (error) {
    return handleApiError(error, "api/workspace/session");
  }
}

export async function PUT(request: Request) {
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

    if (parsed.data.workspace === null) {
      const { error } = await auth.supabase
        .from("workspace_sessions")
        .delete()
        .eq("user_id", auth.user.id);

      if (error) throw error;
      return NextResponse.json({ workspace: null });
    }

    const workspace = normalizeWorkspaceState(parsed.data.workspace);
    if (!workspace) {
      return NextResponse.json({ error: "Invalid workspace payload" }, { status: 400 });
    }

    const { error } = await auth.supabase.from("workspace_sessions").upsert(
      {
        user_id: auth.user.id,
        workspace_state: workspace as unknown as Record<string, unknown>,
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ workspace });
  } catch (error) {
    return handleApiError(error, "api/workspace/session");
  }
}

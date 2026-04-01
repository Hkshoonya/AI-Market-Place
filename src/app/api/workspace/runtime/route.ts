import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import {
  buildWorkspaceRuntimeAssistantPath,
  buildWorkspaceRuntimeEndpointPath,
  buildWorkspaceRuntimeEndpointSlug,
} from "@/lib/workspace/runtime";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  modelSlug: z.string().trim().min(1).max(160),
  modelName: z.string().trim().min(1).max(200),
  providerName: z.string().trim().max(200).nullable().optional(),
  conversationId: z.string().trim().min(1).nullable().optional(),
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
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const modelSlug = url.searchParams.get("modelSlug");
    if (!modelSlug) {
      return NextResponse.json({ runtime: null });
    }

    const { data, error } = await auth.supabase
      .from("workspace_runtimes")
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.user.id)
      .eq("model_slug", modelSlug)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      runtime: data ? toRuntimeResponse(data) : null,
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/runtime");
  }
}

export async function POST(request: Request) {
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

    const { data: existing, error: existingError } = await auth.supabase
      .from("workspace_runtimes")
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .eq("user_id", auth.user.id)
      .eq("model_slug", parsed.data.modelSlug)
      .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
      user_id: auth.user.id,
      model_slug: parsed.data.modelSlug,
      model_name: parsed.data.modelName,
      provider_name: parsed.data.providerName ?? null,
      workspace_conversation_id: parsed.data.conversationId ?? null,
      status: "ready" as const,
      endpoint_slug: existing?.endpoint_slug ?? buildWorkspaceRuntimeEndpointSlug(parsed.data.modelSlug),
    };

    const { data, error } = await auth.supabase
      .from("workspace_runtimes")
      .upsert(payload, { onConflict: "user_id,model_slug" })
      .select(
        "id, model_slug, model_name, provider_name, status, endpoint_slug, total_requests, total_tokens, last_used_at, updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      runtime: toRuntimeResponse(data),
      activation: {
        message:
          "Runtime session prepared inside AI Market Cap. Chat, API keys, and future model usage can attach to this same runtime record.",
      },
    });
  } catch (error) {
    return handleApiError(error, "api/workspace/runtime");
  }
}

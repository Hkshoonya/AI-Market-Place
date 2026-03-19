import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import {
  clearAgentProviderModelOverrideCache,
  getAgentProviderModelOverrides,
  getEffectiveAgentProviderModels,
} from "@/lib/agents/provider-model-config";
import {
  AGENT_PROVIDER_MODEL_SUGGESTIONS,
  AGENT_PROVIDER_ORDER,
  type AgentProviderName,
  DEFAULT_AGENT_PROVIDER_MODELS,
} from "@/lib/agents/provider-model-constants";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  provider: z.enum(["openrouter", "deepseek", "minimax", "anthropic"]),
  model: z.string().trim().max(200).optional().default(""),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const overrides = await getAgentProviderModelOverrides(true);
    const effectiveModels = await getEffectiveAgentProviderModels(true);

    return NextResponse.json({
      defaults: DEFAULT_AGENT_PROVIDER_MODELS,
      overrides,
      effectiveModels,
      suggestions: AGENT_PROVIDER_MODEL_SUGGESTIONS,
      providerOrder: AGENT_PROVIDER_ORDER,
    });
  } catch (error) {
    return handleApiError(error, "api/admin/agent-models");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { provider, model } = parsed.data;
    const admin = createAdminClient();

    if (!model) {
      const { error } = await admin
        .from("agent_provider_settings")
        .delete()
        .eq("provider", provider);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const payload: {
        provider: AgentProviderName;
        model_id: string;
        updated_by: string;
      } = {
        provider,
        model_id: model,
        updated_by: auth.userId as string,
      };

      const { error } = await admin
        .from("agent_provider_settings")
        .upsert(payload, { onConflict: "provider" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    clearAgentProviderModelOverrideCache();

    const overrides = await getAgentProviderModelOverrides(true);
    const effectiveModels = await getEffectiveAgentProviderModels(true);

    return NextResponse.json({
      defaults: DEFAULT_AGENT_PROVIDER_MODELS,
      overrides,
      effectiveModels,
      suggestions: AGENT_PROVIDER_MODEL_SUGGESTIONS,
      providerOrder: AGENT_PROVIDER_ORDER,
    });
  } catch (error) {
    return handleApiError(error, "api/admin/agent-models");
  }
}

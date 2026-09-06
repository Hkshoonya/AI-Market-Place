import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";
import { rateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import {
  encryptProviderSecret,
  getProviderSecretHint,
} from "@/lib/provider-connections/crypto";
import {
  listProviderConnections,
  toPublicProviderConnection,
} from "@/lib/provider-connections/server";
import {
  PROVIDER_CONNECTIONS,
  validateProviderCredential,
} from "@/lib/provider-connections/providers";

export const dynamic = "force-dynamic";

const ConnectionSchema = z.object({
  provider: z.enum(["openrouter", "replicate", "huggingface", "runpod"]),
  token: z.string().trim().min(8).max(1000),
  displayName: z.string().trim().min(2).max(100).optional(),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({ connections: await listProviderConnections(user.id) });
  } catch (error) {
    return handleApiError(error, "api/provider-connections");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;

    const limit = await rateLimit(`provider-connections:${user.id}`, RATE_LIMITS.auth);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many provider connection attempts. Try again shortly." },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const parsed = ConnectionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid provider connection" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    if (parsed.data.provider === "runpod") {
      const { data: profile, error: profileError } = await admin.from("profiles").select("is_banned").eq("id", user.id).single();
      if (profileError || !profile || profile.is_banned) {
        return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
      }
    }
    const validation = await validateProviderCredential(
      parsed.data.provider,
      parsed.data.token
    );
    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await admin
      .from("provider_connections")
      .select("id, external_account_id")
      .eq("user_id", user.id)
      .eq("provider", parsed.data.provider)
      .maybeSingle();
    if (existingError) throw existingError;

    if (
      existing?.external_account_id &&
      validation.externalAccountId &&
      existing.external_account_id !== validation.externalAccountId
    ) {
      const { count, error: deploymentError } = await admin
        .from("workspace_deployments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("provider_connection_id", existing.id);
      if (deploymentError) throw deploymentError;
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "This key belongs to a different provider account. Remove deployments using the current account before replacing it.",
          },
          { status: 409 }
        );
      }
      if (parsed.data.provider === "runpod") {
        const { count: pods, error } = await admin.from("runpod_pods").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("provider_connection_id", existing.id)
          .not("status", "in", "(quoted,terminated,failed)");
        if (error) throw error;
        if (pods) return NextResponse.json({ error: "Terminate Runpod Pods before switching accounts." }, { status: 409 });
      }
    }

    const { data, error } = await admin
      .from("provider_connections")
      .upsert(
        {
          user_id: user.id,
          provider: parsed.data.provider,
          display_name:
            parsed.data.displayName ?? PROVIDER_CONNECTIONS[parsed.data.provider].name,
          encrypted_secret: encryptProviderSecret(parsed.data.token),
          secret_hint: getProviderSecretHint(parsed.data.token),
          external_account_id: validation.externalAccountId,
          external_account_name: validation.externalAccountName,
          capabilities: validation.capabilities,
          status: "active",
          last_validated_at: now,
          last_error: null,
        },
        { onConflict: "user_id,provider" }
      )
      .select(
        "id, provider, display_name, secret_hint, external_account_id, external_account_name, capabilities, status, last_validated_at, last_used_at, last_error, created_at, updated_at"
      )
      .single();

    if (error) throw error;
    return NextResponse.json(
      {
        connection: toPublicProviderConnection(
          data as unknown as Record<string, unknown>
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /rejected this credential|management keys are not accepted/i.test(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return handleApiError(error, "api/provider-connections");
  }
}

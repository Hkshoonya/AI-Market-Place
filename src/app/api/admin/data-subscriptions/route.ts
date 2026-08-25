import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

const GrantSchema = z.object({
  userId: z.string().uuid(),
  planSlug: z.enum(["free", "pro", "business"]),
  status: z.enum(["active", "trialing", "expired"]).default("active"),
  periodDays: z.number().int().min(1).max(3660).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_banned")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin || profile.is_banned === true) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const admin = createAdminClient();
    const [
      { data: subscriptions, error },
      { data: plans, error: plansError },
      { data: profiles, error: profileError },
    ] =
      await Promise.all([
        admin
          .from("data_api_subscriptions")
          .select(
            "id, user_id, plan_slug, status, source, current_period_start, current_period_end, notes, created_at, updated_at"
          )
          .order("updated_at", { ascending: false })
          .limit(500),
        admin
          .from("data_api_plans")
          .select("slug, name, monthly_price_cents, monthly_request_limit, rate_limit_per_minute")
          .order("monthly_price_cents"),
        admin
          .from("profiles")
          .select("id, username, display_name, email")
          .order("joined_at", { ascending: false })
          .limit(1000),
      ]);
    if (error) throw error;
    if (plansError) throw plansError;
    if (profileError) throw profileError;
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return NextResponse.json({
      subscriptions: (subscriptions ?? []).map((subscription) => ({
        ...subscription,
        profile: profilesById.get(subscription.user_id) ?? null,
      })),
      plans: plans ?? [],
      users: profiles ?? [],
    });
  } catch (error) {
    return handleApiError(error, "api/admin/data-subscriptions");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;

    const parsed = GrantSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid subscription grant" },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodEnd = parsed.data.periodDays
      ? new Date(now.getTime() + parsed.data.periodDays * 86_400_000).toISOString()
      : null;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("data_api_subscriptions")
      .upsert(
        {
          user_id: parsed.data.userId,
          plan_slug: parsed.data.planSlug,
          status: parsed.data.status,
          source: "admin",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd,
          granted_by: auth.user.id,
          notes: parsed.data.notes ?? null,
        },
        { onConflict: "user_id" }
      )
      .select(
        "id, user_id, plan_slug, status, source, current_period_start, current_period_end, notes, updated_at"
      )
      .single();
    if (error) throw error;

    return NextResponse.json({ subscription: data });
  } catch (error) {
    return handleApiError(error, "api/admin/data-subscriptions");
  }
}

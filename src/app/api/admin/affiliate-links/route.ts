import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";
import { checkAffiliateDestination } from "@/lib/affiliate/health";
import { parseSafeAffiliateDestination } from "@/lib/affiliate/url";

export const dynamic = "force-dynamic";

const LinkFieldsSchema = z.object({
  platformSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  modelSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,159}$/)
    .nullable()
    .optional(),
  destinationUrl: z.string().trim().url().max(2000),
  programName: z.string().trim().min(2).max(120),
  campaignName: z.string().trim().max(120).nullable().optional(),
  commissionDetails: z.string().trim().max(300).nullable().optional(),
  disclosureText: z.string().trim().min(2).max(160).default("Partner-supported link"),
  status: z.enum(["draft", "active", "paused", "invalid"]).default("draft"),
  priority: z.number().int().min(0).max(10000).default(100),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const CreateSchema = LinkFieldsSchema;
const UpdateSchema = LinkFieldsSchema.partial().extend({ id: z.string().uuid() });
const DeleteSchema = z.object({ id: z.string().uuid() });

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

async function resolveTargets(
  admin: ReturnType<typeof createAdminClient>,
  platformSlug: string,
  modelSlug?: string | null
) {
  const { data: platform, error: platformError } = await admin
    .from("deployment_platforms")
    .select("id, slug, name")
    .eq("slug", platformSlug)
    .single();
  if (platformError || !platform) throw new Error("Deployment platform not found");

  if (!modelSlug) return { platform, model: null };
  const { data: model, error: modelError } = await admin
    .from("models")
    .select("id, slug, name")
    .eq("slug", modelSlug)
    .single();
  if (modelError || !model) throw new Error("Model slug not found");
  return { platform, model };
}

async function syncPlatformFlag(
  admin: ReturnType<typeof createAdminClient>,
  platformId: string
) {
  const now = new Date().toISOString();
  const { count, error } = await admin
    .from("affiliate_links")
    .select("id", { count: "exact", head: true })
    .eq("platform_id", platformId)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) throw error;
  const { error: updateError } = await admin
    .from("deployment_platforms")
    .update({
      has_affiliate: (count ?? 0) > 0,
      affiliate_url: null,
      affiliate_tag: null,
      updated_at: now,
    })
    .eq("id", platformId);
  if (updateError) throw updateError;
}

async function verifyForActivation(destinationUrl: string, status: string) {
  parseSafeAffiliateDestination(destinationUrl);
  if (status !== "active") return null;

  const health = await checkAffiliateDestination(destinationUrl);
  if (!health.ok) {
    throw new Error(health.error ?? "Destination failed its activation health check");
  }
  return health;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const admin = createAdminClient();

    const [linksResult, platformsResult, clicksResult] = await Promise.all([
      admin
        .from("affiliate_links")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500),
      admin
        .from("deployment_platforms")
        .select("id, slug, name, type, has_affiliate")
        .order("name"),
      admin
        .from("affiliate_click_daily")
        .select("affiliate_link_id, clicks")
        .limit(5000),
    ]);
    if (linksResult.error) throw linksResult.error;
    if (platformsResult.error) throw platformsResult.error;
    if (clicksResult.error) throw clicksResult.error;

    const links = linksResult.data ?? [];
    const modelIds = [...new Set(links.map((link) => link.model_id).filter(Boolean))] as string[];
    const { data: models, error: modelsError } = modelIds.length
      ? await admin.from("models").select("id, slug, name").in("id", modelIds)
      : { data: [], error: null };
    if (modelsError) throw modelsError;

    const platformsById = new Map(
      (platformsResult.data ?? []).map((platform) => [platform.id, platform])
    );
    const modelsById = new Map((models ?? []).map((model) => [model.id, model]));
    const clicksByLink = new Map<string, number>();
    for (const row of clicksResult.data ?? []) {
      clicksByLink.set(
        row.affiliate_link_id,
        (clicksByLink.get(row.affiliate_link_id) ?? 0) + Number(row.clicks)
      );
    }

    return NextResponse.json({
      links: links.map((link) => ({
        ...link,
        platform: platformsById.get(link.platform_id) ?? null,
        model: link.model_id ? modelsById.get(link.model_id) ?? null : null,
        total_clicks: clicksByLink.get(link.id) ?? 0,
      })),
      platforms: platformsResult.data ?? [],
    });
  } catch (error) {
    return handleApiError(error, "api/admin/affiliate-links");
  }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;

    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid affiliate link" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { platform, model } = await resolveTargets(
      admin,
      parsed.data.platformSlug,
      parsed.data.modelSlug
    );
    const health = await verifyForActivation(parsed.data.destinationUrl, parsed.data.status);
    const { data, error } = await admin
      .from("affiliate_links")
      .insert({
        platform_id: platform.id,
        model_id: model?.id ?? null,
        destination_url: parsed.data.destinationUrl,
        program_name: parsed.data.programName,
        campaign_name: parsed.data.campaignName ?? null,
        commission_details: parsed.data.commissionDetails ?? null,
        disclosure_text: parsed.data.disclosureText,
        status: parsed.data.status,
        priority: parsed.data.priority,
        starts_at: parsed.data.startsAt ?? null,
        ends_at: parsed.data.endsAt ?? null,
        last_checked_at: health ? new Date().toISOString() : null,
        last_check_status: health?.status ?? null,
        last_http_status: health?.httpStatus ?? null,
        consecutive_failures: 0,
        last_error: null,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    await syncPlatformFlag(admin, platform.id);

    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /destination|platform|model slug/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return handleApiError(error, "api/admin/affiliate-links");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;

    const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid affiliate link update" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("affiliate_links")
      .select("*")
      .eq("id", parsed.data.id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: "Affiliate link not found" }, { status: 404 });
    }

    const platformSlug = parsed.data.platformSlug;
    const currentPlatform = await admin
      .from("deployment_platforms")
      .select("slug")
      .eq("id", existing.platform_id)
      .single();
    if (currentPlatform.error || !currentPlatform.data) throw new Error("Deployment platform not found");
    const { platform, model } = await resolveTargets(
      admin,
      platformSlug ?? currentPlatform.data.slug,
      parsed.data.modelSlug === undefined
        ? existing.model_id
          ? (
              await admin.from("models").select("slug").eq("id", existing.model_id).single()
            ).data?.slug ?? null
          : null
        : parsed.data.modelSlug
    );
    const destinationUrl = parsed.data.destinationUrl ?? existing.destination_url;
    const status = parsed.data.status ?? existing.status;
    const health = await verifyForActivation(destinationUrl, status);
    const { data, error } = await admin
      .from("affiliate_links")
      .update({
        platform_id: platform.id,
        model_id: model?.id ?? null,
        destination_url: destinationUrl,
        program_name: parsed.data.programName ?? existing.program_name,
        campaign_name:
          parsed.data.campaignName === undefined
            ? existing.campaign_name
            : parsed.data.campaignName,
        commission_details:
          parsed.data.commissionDetails === undefined
            ? existing.commission_details
            : parsed.data.commissionDetails,
        disclosure_text: parsed.data.disclosureText ?? existing.disclosure_text,
        status,
        priority: parsed.data.priority ?? existing.priority,
        starts_at: parsed.data.startsAt === undefined ? existing.starts_at : parsed.data.startsAt,
        ends_at: parsed.data.endsAt === undefined ? existing.ends_at : parsed.data.endsAt,
        last_checked_at: health ? new Date().toISOString() : existing.last_checked_at,
        last_check_status: health?.status ?? existing.last_check_status,
        last_http_status: health?.httpStatus ?? existing.last_http_status,
        consecutive_failures: health ? 0 : existing.consecutive_failures,
        last_error: health ? null : existing.last_error,
        updated_by: auth.user.id,
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single();
    if (error) throw error;
    await Promise.all([
      syncPlatformFlag(admin, existing.platform_id),
      platform.id === existing.platform_id ? Promise.resolve() : syncPlatformFlag(admin, platform.id),
    ]);

    return NextResponse.json({ link: data });
  } catch (error) {
    if (error instanceof Error && /destination|platform|model slug/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return handleApiError(error, "api/admin/affiliate-links");
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;
    const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid link id" }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("affiliate_links")
      .delete()
      .eq("id", parsed.data.id)
      .select("platform_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Affiliate link not found" }, { status: 404 });
    await syncPlatformFlag(admin, data.platform_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "api/admin/affiliate-links");
  }
}

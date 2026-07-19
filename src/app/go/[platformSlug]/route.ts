import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSafeAffiliateDestination, sanitizeAffiliateSource } from "@/lib/affiliate/url";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const PlatformSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const ModelSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,159}$/);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platformSlug: string }> }
) {
  try {
    const platformSlug = PlatformSlugSchema.safeParse((await params).platformSlug);
    if (!platformSlug.success) {
      return NextResponse.json({ error: "Unknown provider link" }, { status: 404 });
    }

    const url = new URL(request.url);
    const modelSlug = ModelSlugSchema.safeParse(url.searchParams.get("model")).success
      ? url.searchParams.get("model")
      : null;
    const source = sanitizeAffiliateSource(url.searchParams.get("source"));
    const admin = createAdminClient();
    const { data: platform, error: platformError } = await admin
      .from("deployment_platforms")
      .select("id, base_url")
      .eq("slug", platformSlug.data)
      .single();
    if (platformError || !platform) {
      return NextResponse.json({ error: "Unknown provider link" }, { status: 404 });
    }

    const { data: model } = modelSlug
      ? await admin.from("models").select("id").eq("slug", modelSlug).maybeSingle()
      : { data: null };
    const now = new Date().toISOString();
    const { data: links, error: linksError } = await admin
      .from("affiliate_links")
      .select("id, model_id, destination_url, priority")
      .eq("platform_id", platform.id)
      .eq("status", "active")
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("priority", { ascending: true })
      .limit(20);
    const availableLinks = linksError ? [] : links ?? [];

    const affiliateLink =
      (model?.id ? availableLinks.find((link) => link.model_id === model.id) : null) ??
      availableLinks.find((link) => link.model_id === null) ??
      null;

    let destination = affiliateLink?.destination_url ?? null;
    if (!destination && model?.id) {
      const { data: deployment } = await admin
        .from("model_deployments")
        .select("deploy_url")
        .eq("model_id", model.id)
        .eq("platform_id", platform.id)
        .eq("status", "available")
        .not("deploy_url", "is", null)
        .limit(1)
        .maybeSingle();
      destination = deployment?.deploy_url ?? null;
    }
    destination = destination ?? platform.base_url;
    const safeDestination = parseSafeAffiliateDestination(destination).toString();

    if (affiliateLink) {
      const { error: clickError } = await admin.rpc("record_affiliate_click", {
        p_affiliate_link_id: affiliateLink.id,
        p_source: source,
      });
      if (clickError) {
        console.warn("affiliate click aggregate failed", {
          linkId: affiliateLink.id,
          message: clickError.message,
        });
      }
    }

    const response = NextResponse.redirect(safeDestination, 307);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    return handleApiError(error, "go/[platformSlug]");
  }
}

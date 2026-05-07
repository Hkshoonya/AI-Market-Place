import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CreditCard, ShieldCheck, Wallet } from "lucide-react";

import { TopSubscriptionProviders } from "@/components/home/top-subscription-providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import {
  buildAccessOffersCatalog,
  type RankedAccessOffer,
} from "@/lib/models/access-offers";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { fetchAllHomepageActiveModels } from "@/lib/homepage/fetch-active-models";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";

export const metadata: Metadata = {
  title: `Pricing & Access | ${SITE_NAME}`,
  description:
    "Compare verified subscription access and platform plans for top AI models.",
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
};

function sumCoveredModels(offers: RankedAccessOffer[]) {
  return offers.reduce((total, offer) => total + offer.modelCount, 0);
}

export default async function PricingPage() {
  const supabase = createOptionalPublicClient() ?? createOptionalAdminClient();

  const allActiveModels = supabase
    ? await fetchAllHomepageActiveModels(
        supabase as unknown as Parameters<typeof fetchAllHomepageActiveModels>[0]
      ).catch((error) => {
        console.warn("pricing page active models query failed", error);
        return [];
      })
    : [];

  const [deploymentPlatformsRaw, modelDeploymentsRaw] = supabase
    ? await Promise.all([
        supabase.from("deployment_platforms").select("*").order("name"),
        supabase
          .from("model_deployments")
          .select(
            "id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status"
          )
          .eq("status", "available"),
      ])
    : [{ data: [] }, { data: [] }];

  const activeModels = preferDefaultPublicSurfaceReady(
    dedupePublicModelFamilies(
      allActiveModels as unknown as Parameters<typeof dedupePublicModelFamilies>[0]
    ),
    200
  );
  const deploymentPlatforms = (deploymentPlatformsRaw.data ?? []).map((platform) => {
    const platformRecord = platform as Record<string, unknown>;

    return {
      id: platform.id,
      slug: platform.slug,
      name: platform.name,
      type: platform.type,
      base_url: platform.base_url,
      has_affiliate: platform.has_affiliate,
      affiliate_url:
        typeof platformRecord.affiliate_url === "string"
          ? platformRecord.affiliate_url
          : platform.affiliate_url_template,
      affiliate_tag:
        typeof platformRecord.affiliate_tag === "string"
          ? platformRecord.affiliate_tag
          : null,
    };
  });

  const accessOffers = buildAccessOffersCatalog({
    platforms: deploymentPlatforms,
    deployments: modelDeploymentsRaw.data ?? [],
    models: activeModels as Parameters<typeof buildAccessOffersCatalog>[0]["models"],
  });
  const subscriptionOffers = accessOffers.subscriptionOffers.slice(0, 12);
  const coveredModelCount = sumCoveredModels(subscriptionOffers);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
      <section className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neon">
          Pricing & Access
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          Verified subscription routes for working with top AI models
        </h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          This page is for the practical buy decision: which paid platforms cover the
          models you actually care about, how trustworthy those plans look, and where
          the tradeoffs are before you sign up.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-neon text-background hover:bg-neon/90" asChild>
            <Link href="/leaderboards">
              Back to rankings
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/api-docs">Use the API instead</Link>
          </Button>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-neon" />
              <div>
                <p className="text-sm text-muted-foreground">Subscription plans tracked</p>
                <p className="text-3xl font-bold">{subscriptionOffers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-neon" />
              <div>
                <p className="text-sm text-muted-foreground">Covered model instances</p>
                <p className="text-3xl font-bold">{coveredModelCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-neon" />
              <div>
                <p className="text-sm text-muted-foreground">What the ranking values</p>
                <p className="text-base font-semibold">Trust, breadth, affordability</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <TopSubscriptionProviders offers={subscriptionOffers} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">How to use this page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Start with plan coverage and price, then check whether the plan includes the models you actually use.</p>
            <p>Use the leaderboards when you need deeper quality or benchmark context before you buy.</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">What this is not</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This is not a full total-cost calculator for heavy API volume. It is a starting point for verified paid access options.</p>
            <p>When a plan includes partner disclosure, that is shown in the action column rather than hidden.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

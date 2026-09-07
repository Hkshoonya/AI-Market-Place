import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { ArrowRight, Database, Gauge } from "lucide-react";

import { TopSubscriptionProviders } from "@/components/home/top-subscription-providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_URL } from "@/lib/constants/site";
import { buildAccessOffersCatalog } from "@/lib/models/access-offers";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { fetchAllHomepageActiveModels } from "@/lib/homepage/fetch-active-models";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";

export const metadata: Metadata = {
  title: "Pricing & Access",
  description:
    "Compare model rates, provider subscriptions, and AI Market Cap data API plans without logging in. See prices, quotas, and billing details before joining.",
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
};

const DATA_API_PLANS = [
  {
    name: "Explorer",
    price: "$0",
    requests: "2,500 requests / month",
    rate: "30 requests / minute",
    history: "30 days of model history",
    pageSize: "Up to 100 models per page",
    cta: "Create a data key",
    href: "/settings/api-keys",
    featured: false,
  },
  {
    name: "Data Pro",
    price: "$49",
    requests: "100,000 requests / month",
    rate: "300 requests / minute",
    history: "Up to one year of recorded history",
    pageSize: "Up to 500 models per page",
    cta: "Request Pro pilot",
    href: "/contact?category=partnership&subject=Data%20Pro%20pilot",
    featured: true,
  },
  {
    name: "Data Business",
    price: "$199",
    requests: "1,000,000 requests / month",
    rate: "1,000 requests / minute",
    history: "Up to one year of recorded history",
    pageSize: "Up to 1,000 models per page",
    cta: "Request Business pilot",
    href: "/contact?category=partnership&subject=Data%20Business%20pilot",
    featured: false,
  },
] as const;

const loadSubscriptionOffers = unstable_cache(async () => {
  const supabase = createOptionalPublicClient();
  if (!supabase) throw new Error("Public pricing client is not configured");

  const allActiveModels = await fetchAllHomepageActiveModels(
    supabase as unknown as Parameters<typeof fetchAllHomepageActiveModels>[0]
  );

  const [deploymentPlatformsRaw, modelDeploymentsRaw] = await Promise.all([
    supabase.from("deployment_platforms").select("*").order("name"),
    supabase
      .from("model_deployments")
      .select(
        "id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status"
      )
      .eq("status", "available"),
  ]);
  if (deploymentPlatformsRaw.error || modelDeploymentsRaw.error) {
    throw new Error("Subscription pricing query failed");
  }

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
  return accessOffers.subscriptionOffers.slice(0, 12);
}, ["public-subscription-offers-v1"], { revalidate: 300 });

async function ProviderSubscriptionPlans() {
  // Keep build-time outages from freezing an empty catalog into the public page.
  await connection();
  const offers = await loadSubscriptionOffers().catch(() => {
    console.warn("Public subscription prices are temporarily unavailable");
    return [];
  });
  return <TopSubscriptionProviders offers={offers} />;
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
      <section className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neon">
          Pricing & Access
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          Rates & subscription plans
        </h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          Compare costs before you join. Browse model rates, provider subscriptions,
          and our data API plans without an account. All prices on this page are in USD.
          Provider inference and hosting are billed separately from AI Market Cap data access.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-neon text-background hover:bg-neon/90" asChild>
            <Link href="/models">
              Compare model rates
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="#provider-subscriptions">Provider subscriptions</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="#data-api-plans">AI Market Cap plans</Link>
          </Button>
        </div>
      </section>

      <section id="data-api-plans" className="mt-12 scroll-mt-24">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neon">
              AI Market Cap data API
            </p>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
              Our plans, quotas, and what you get
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Every plan uses scoped API keys, monthly quotas, and per-minute controls. Pro and
              Business are pilot grants for now; paid checkout is not enabled.
              History varies by model and collection start date. Prices below are proposed monthly plans;
              requesting a pilot does not charge you or create a subscription.
              These plans provide model data, not model inference, GPU time, or provider subscriptions.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/api-docs">Read API documentation</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {DATA_API_PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.featured
                  ? "relative overflow-hidden border-neon/40 bg-gradient-to-b from-neon/10 to-card"
                  : "border-border/50 bg-card"
              }
            >
              {plan.featured ? (
                <div className="absolute right-0 top-0 rounded-bl-xl bg-neon px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-background">
                  Production pilot
                </div>
              ) : null}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {plan.name === "Explorer" ? "Free access; sign in to create an API key" : "Proposed price; pilot request only, not available to buy"}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="pb-1 text-sm text-muted-foreground">/ month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Database className="h-4 w-4 text-neon" />{plan.requests}</p>
                  <p className="flex items-center gap-2"><Gauge className="h-4 w-4 text-neon" />{plan.rate}</p>
                  <p>{plan.history}</p>
                  <p>{plan.pageSize}</p>
                </div>
                <Button
                  className={plan.featured ? "w-full bg-neon text-background hover:bg-neon/90" : "w-full"}
                  variant={plan.featured ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="border-border/50 bg-card">
          <CardHeader><CardTitle className="text-lg">Bring model intelligence into your product</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Evaluate the API with Explorer. Tell us your request volume, integration needs, and intended data use to agree a production pilot. Provider inference charges are separate.</p>
            <Button variant="outline" asChild><Link href="/contact?category=partnership&subject=Production%20data%20API%20access">Discuss a data integration<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardHeader><CardTitle className="text-lg">Reach people evaluating AI tools</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Discuss a clearly labelled sponsorship or provider partnership. Placement and pricing are agreed before publication. Sponsorship does not buy a higher model rank or change benchmark results.</p>
            <Button variant="outline" asChild><Link href="/contact?category=sponsorship&subject=AI%20Market%20Cap%20sponsorship">Enquire about sponsorship<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </section>

      <section id="provider-subscriptions" className="mt-10 scroll-mt-24" aria-label="Provider subscriptions">
        <Suspense fallback={<p role="status" className="rounded-xl border border-border/50 p-6 text-sm text-muted-foreground">Loading provider subscription prices...</p>}>
          <ProviderSubscriptionPlans />
        </Suspense>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">How to use this page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Browsing rates and plan details is free, with no login required. Sign in only when you need account features such as API keys, saved models, or a workspace.</p>
            <p>Model pages show input and output prices per million tokens, or the applicable request, GPU, or monthly unit. Missing or stale pricing is not treated as free.</p>
            <p>Provider plans have their own billing cycles, cancellation rules, and usage caps. Related model listings are not a guarantee of plan entitlement; confirm the exact model with the provider.</p>
            <p>Use the leaderboards when you need deeper quality or benchmark context before you buy.</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">What this is not</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This is not a full total-cost calculator. Context length, caching, tools, regional pricing, taxes, and provider terms can change your final bill.</p>
            <p>API credits are not automatically included in a chat subscription. GPU hosting and open-weight model inference can incur separate charges.</p>
            <p>When a plan includes partner disclosure, that is shown in the action column rather than hidden.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

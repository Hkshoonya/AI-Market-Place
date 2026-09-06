import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CreditCard, Database, Gauge, ShieldCheck, Wallet } from "lucide-react";

import { TopSubscriptionProviders } from "@/components/home/top-subscription-providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_URL } from "@/lib/constants/site";
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
  title: "Pricing & Access",
  description:
    "Compare AI Market Cap data API plans and verified subscription access for top AI models.",
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
};

function sumCoveredModels(offers: RankedAccessOffer[]) {
  return offers.reduce((total, offer) => total + offer.modelCount, 0);
}

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
          AI model intelligence for your next product
        </h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          Build model discovery, research dashboards, and provider comparisons with
          structured rankings, benchmark evidence, pricing, and recorded history.
          Start with a free API key, then discuss production access as your usage grows.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-neon text-background hover:bg-neon/90" asChild>
            <Link href="/settings/api-keys">
              Start with the free API
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/api-docs">Explore the API documentation</Link>
          </Button>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neon">
              First-party data API
            </p>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
              Build with rankings, model records, search, and history
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Every plan uses scoped API keys, monthly quotas, and per-minute controls. Pro and
              Business are pilot grants for now; online checkout is intentionally disabled until
              the correct AI Market Cap payment account is connected.
              History varies by model and collection start date. Prices below are proposed monthly plans;
              requesting a pilot does not charge you or create a subscription.
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

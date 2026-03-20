import { notFound } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, Bot, Calendar, Eye, ScrollText, ShieldCheck, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseQueryResultSingle } from "@/lib/schemas/parse";
import { MarketplaceListingSchema } from "@/lib/schemas/marketplace";
import { SellerCard } from "@/components/marketplace/seller-card";
import { ListingReviews } from "@/components/marketplace/listing-reviews";
import { ContactForm } from "@/components/marketplace/contact-form";
import { ViewTracker } from "@/components/marketplace/view-tracker";
import { ReportListingButton } from "@/components/marketplace/report-listing-button";
import { PurchaseButton } from "@/components/marketplace/purchase-button";
import { ManifestPreviewCard } from "@/components/marketplace/manifest-preview-card";
import { SettlementPolicyCallout } from "@/components/marketplace/settlement-policy-callout";
import { LISTING_TYPE_MAP, PRICING_TYPE_LABELS } from "@/lib/constants/marketplace";
import { enrichListingWithProfile, PROFILE_FIELDS_FULL } from "@/lib/marketplace/enrich-listings";
import { buildListingPreviewManifest } from "@/lib/marketplace/manifest";
import { attachListingPolicies } from "@/lib/marketplace/policy-read";
import {
  getListingCommerceSignals,
  getListingPillClasses,
} from "@/lib/marketplace/presentation";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { SITE_URL } from "@/lib/constants/site";
import type { Metadata } from "next";
import type { MarketplacePricingType } from "@/types/database";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const supabase = createPublicClient();
  const ListingMetaSchema = z.object({
    title: z.string(),
    short_description: z.string().nullable(),
    listing_type: z.string(),
  });
  const metaResponse = await supabase
    .from("marketplace_listings")
    .select("title, short_description, listing_type")
    .eq("slug", slug)
    .single();

  const data = parseQueryResultSingle(metaResponse, ListingMetaSchema, "ListingMeta");

  const title = data?.title || "Marketplace Listing";
  const description =
    data?.short_description ||
    `Browse this ${data?.listing_type?.replace(/_/g, " ") ?? "AI"} listing on the AI Market Cap marketplace.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

export default async function ListingDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const supabase = createPublicClient();
  const admin = createAdminClient();

  const listingResponse = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("slug", slug)
    .single();

  const rawListing = parseQueryResultSingle(listingResponse, MarketplaceListingSchema, "ListingDetail");
  if (!rawListing) notFound();
  const [listingWithPolicy] = await attachListingPolicies(admin, [rawListing]);
  if (!listingWithPolicy) notFound();

  // Enrich with seller profile (no FK exists, so fetch separately)
  const listing = await enrichListingWithProfile(
    supabase,
    listingWithPolicy,
    PROFILE_FIELDS_FULL
  );
  const previewManifest = buildListingPreviewManifest({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    short_description: listing.short_description ?? null,
    listing_type: listing.listing_type,
    pricing_type: listing.pricing_type,
    price: listing.price,
    currency: listing.currency,
    documentation_url: listing.documentation_url ?? null,
    demo_url: listing.demo_url ?? null,
    tags: listing.tags,
    agent_config: listing.agent_config ?? null,
    mcp_manifest: listing.mcp_manifest ?? null,
    preview_manifest: listing.preview_manifest ?? null,
  });
  const commerceSignals = getListingCommerceSignals(listing);

  const typeConfig = LISTING_TYPE_MAP[listing.listing_type as keyof typeof LISTING_TYPE_MAP];

  // Build JSON-LD Product structured data
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.short_description || listing.description?.slice(0, 200) || "",
    url: `${SITE_URL}/marketplace/${slug}`,
    category: typeConfig?.label || listing.listing_type?.replace(/_/g, " ") || "AI Product",
  };

  if (listing.profiles?.display_name) {
    jsonLd.brand = {
      "@type": "Organization",
      name: listing.profiles.display_name,
    };
  }

  if (listing.pricing_type === "free") {
    jsonLd.offers = {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    };
  } else if (listing.price && listing.pricing_type !== "contact") {
    jsonLd.offers = {
      "@type": "Offer",
      price: String(listing.price),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    };
  }

  if (listing.avg_rating && listing.review_count > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(Number(listing.avg_rating).toFixed(1)),
      bestRating: "5",
      reviewCount: String(listing.review_count),
    };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ViewTracker listingId={listing.id} />
      <Link
        href="/marketplace/browse"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-neon"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="gap-1">
                {typeConfig && <typeConfig.icon className="h-3 w-3" />}
                {typeConfig?.label || listing.listing_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {PRICING_TYPE_LABELS[listing.pricing_type as keyof typeof PRICING_TYPE_LABELS] || listing.pricing_type}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            {listing.short_description && (
              <p className="mt-2 text-muted-foreground">{listing.short_description}</p>
            )}
          </div>

          {/* Price Card */}
          <Card className="border-neon/20 bg-neon/5">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-2xl font-bold text-neon sm:text-3xl">
                  {listing.pricing_type === "free" ? "Free" :
                   listing.pricing_type === "contact" ? "Contact for Pricing" :
                   formatCurrency(listing.price)}
                  {listing.pricing_type === "monthly_subscription" && (
                    <span className="text-base font-normal text-muted-foreground">/month</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <PurchaseButton
                  listingId={listing.id}
                  price={listing.price}
                  pricingType={listing.pricing_type}
                  sellerName={(listing.profiles?.display_name as string | null) ?? undefined}
                />
                <ContactForm
                  listing={{
                    id: listing.id,
                    title: listing.title,
                    seller_id: listing.seller_id,
                    pricing_type: listing.pricing_type as MarketplacePricingType,
                    price: listing.price,
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <SettlementPolicyCallout />

          <Card className="border-border/50 bg-card">
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Purchase Mode
                </div>
                <Badge
                  variant="outline"
                  className={`mt-3 ${getListingPillClasses(commerceSignals.purchase.tone)}`}
                >
                  {commerceSignals.purchase.label}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {commerceSignals.purchase.description}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" />
                  Autonomy
                </div>
                <Badge
                  variant="outline"
                  className={`mt-3 ${getListingPillClasses(commerceSignals.autonomy.tone)}`}
                >
                  {commerceSignals.autonomy.label}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {commerceSignals.autonomy.description}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <ScrollText className="h-3.5 w-3.5" />
                  Delivery Contract
                </div>
                <Badge
                  variant="outline"
                  className={`mt-3 ${getListingPillClasses(commerceSignals.manifest.tone)}`}
                >
                  {commerceSignals.manifest.label}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {commerceSignals.manifest.description}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" />
                  Seller Mode
                </div>
                <Badge
                  variant="outline"
                  className={`mt-3 ${getListingPillClasses(commerceSignals.seller.tone)}`}
                >
                  {commerceSignals.seller.label}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {commerceSignals.seller.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground sm:gap-6">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4 shrink-0" />
              {formatNumber(listing.view_count)} views
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 shrink-0" />
              Listed {formatDate(listing.created_at)}
            </div>
            {listing.tags?.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-4 w-4 shrink-0" />
                {listing.tags.length} tags
              </div>
            )}
            <div className="ml-auto">
              <ReportListingButton listingSlug={slug} />
            </div>
          </div>

          {/* Tags */}
          {listing.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {listing.tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Description */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Description</h2>
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">
                {listing.description}
              </div>
            </CardContent>
          </Card>

          <ManifestPreviewCard manifest={previewManifest} />

          {/* Links */}
          {(listing.demo_url || listing.documentation_url) && (
            <div className="flex gap-3">
              {listing.demo_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={listing.demo_url} target="_blank" rel="noopener noreferrer">
                    View Demo
                  </a>
                </Button>
              )}
              {listing.documentation_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={listing.documentation_url} target="_blank" rel="noopener noreferrer">
                    Documentation
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Reviews */}
          <ListingReviews listingId={listing.id} listingSlug={slug} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {listing.profiles && (() => {
            const SellerProfileSchema = z.object({
              id: z.string(),
              display_name: z.string().nullable(),
              username: z.string().nullable(),
              avatar_url: z.string().nullable(),
              seller_bio: z.string().nullable(),
              seller_website: z.string().nullable(),
              seller_verified: z.boolean(),
              seller_rating: z.number().nullable(),
              total_sales: z.number(),
              created_at: z.string(),
            });
            const parsed = SellerProfileSchema.safeParse(listing.profiles);
            if (!parsed.success) return null;
            return <SellerCard seller={parsed.data} />;
          })()}
        </div>
      </div>
    </div>
  );
}

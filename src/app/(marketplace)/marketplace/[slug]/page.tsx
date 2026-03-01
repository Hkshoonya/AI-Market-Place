import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Eye, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SellerCard } from "@/components/marketplace/seller-card";
import { ListingReviews } from "@/components/marketplace/listing-reviews";
import { ContactForm } from "@/components/marketplace/contact-form";
import { ViewTracker } from "@/components/marketplace/view-tracker";
import { ReportListingButton } from "@/components/marketplace/report-listing-button";
import { PurchaseButton } from "@/components/marketplace/purchase-button";
import { LISTING_TYPE_MAP, PRICING_TYPE_LABELS } from "@/lib/constants/marketplace";
import { enrichListingWithProfile, PROFILE_FIELDS_FULL } from "@/lib/marketplace/enrich-listings";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { SITE_URL } from "@/lib/constants/site";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("marketplace_listings")
    .select("title, short_description, listing_type")
    .eq("slug", slug)
    .single();

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
  const supabase = await createClient();

  const { data: rawListing, error } = await (supabase as any)
    .from("marketplace_listings")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !rawListing) notFound();

  // Enrich with seller profile (no FK exists, so fetch separately)
  const listing = await enrichListingWithProfile(
    supabase as any,
    rawListing,
    PROFILE_FIELDS_FULL
  );

  const typeConfig = LISTING_TYPE_MAP[listing.listing_type as keyof typeof LISTING_TYPE_MAP];

  // Build JSON-LD Product structured data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-3xl font-bold text-neon">
                  {listing.pricing_type === "free" ? "Free" :
                   listing.pricing_type === "contact" ? "Contact for Pricing" :
                   formatCurrency(listing.price)}
                  {listing.pricing_type === "monthly_subscription" && (
                    <span className="text-base font-normal text-muted-foreground">/month</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <PurchaseButton
                  listingId={listing.id}
                  price={listing.price}
                  pricingType={listing.pricing_type}
                  sellerName={listing.profiles?.display_name}
                />
                <ContactForm listing={listing} />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {formatNumber(listing.view_count)} views
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Listed {formatDate(listing.created_at)}
            </div>
            {listing.tags?.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
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
          <SellerCard seller={listing.profiles} />
        </div>
      </div>
    </div>
  );
}

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
import { LISTING_TYPE_MAP, PRICING_TYPE_LABELS } from "@/lib/constants/marketplace";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
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

  const { data: listing, error } = await (supabase as any)
    .from("marketplace_listings")
    .select("*, profiles!marketplace_listings_seller_id_fkey(id, display_name, avatar_url, username, is_seller, seller_verified, seller_rating, total_sales, seller_bio, seller_website, created_at)")
    .eq("slug", slug)
    .single();

  if (error || !listing) notFound();

  const typeConfig = LISTING_TYPE_MAP[listing.listing_type as keyof typeof LISTING_TYPE_MAP];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
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
              <ContactForm listing={listing} />
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="flex gap-6 text-sm text-muted-foreground">
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

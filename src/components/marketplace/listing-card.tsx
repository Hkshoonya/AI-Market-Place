import Link from "next/link";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LISTING_TYPE_MAP } from "@/lib/constants/marketplace";
import { formatCurrency } from "@/lib/format";
import type { MarketplaceListingWithSeller } from "@/types/database";

interface ListingCardProps {
  listing: MarketplaceListingWithSeller;
}

export function ListingCard({ listing }: ListingCardProps) {
  const typeConfig = LISTING_TYPE_MAP[listing.listing_type];
  const TypeIcon = typeConfig?.icon;
  const sellerName = listing.profiles?.display_name || "Unknown Seller";

  return (
    <Link href={`/marketplace/${listing.slug}`} aria-label={`${listing.title} by ${sellerName}, ${listing.pricing_type === "free" ? "Free" : listing.pricing_type === "contact" ? "Contact for pricing" : formatCurrency(listing.price)}`}>
      <Card className="group h-full cursor-pointer border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] text-muted-foreground gap-1">
              {TypeIcon && <TypeIcon className="h-3 w-3" />}
              {typeConfig?.shortLabel || listing.listing_type}
            </Badge>
            {listing.is_featured && (
              <Badge className="bg-neon/10 text-neon text-[10px] border-neon/30">Featured</Badge>
            )}
          </div>
          <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors line-clamp-2">
            {listing.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            by {sellerName}
            {listing.profiles?.seller_verified && (
              <span className="ml-1 text-neon" title="Verified Seller">&#10003;</span>
            )}
          </p>

          {listing.short_description && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {listing.short_description}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            {listing.avg_rating != null && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                <span className="text-sm font-medium">{listing.avg_rating.toFixed(1)}</span>
              </div>
            )}
            {listing.review_count > 0 && (
              <span className="text-xs text-muted-foreground">
                ({listing.review_count} review{listing.review_count !== 1 ? "s" : ""})
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {listing.inquiry_count} inquiries
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
            <span className="text-lg font-bold text-neon">
              {listing.pricing_type === "free" ? "Free" :
               listing.pricing_type === "contact" ? "Contact" :
               formatCurrency(listing.price)}
              {listing.pricing_type === "monthly_subscription" && (
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              )}
              {listing.pricing_type === "per_token" && (
                <span className="text-xs font-normal text-muted-foreground">/1M tok</span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

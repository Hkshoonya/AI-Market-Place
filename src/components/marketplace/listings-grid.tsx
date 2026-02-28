import { Package } from "lucide-react";
import { ListingCard } from "./listing-card";
import type { MarketplaceListingWithSeller } from "@/types/database";

interface ListingsGridProps {
  listings: MarketplaceListingWithSeller[];
}

export function ListingsGrid({ listings }: ListingsGridProps) {
  if (listings.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="flex flex-col items-center gap-2">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No listings found</p>
          <p className="text-xs text-muted-foreground/70">
            Try adjusting your filters or search query.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

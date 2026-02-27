import { ListingCard } from "./listing-card";
import type { MarketplaceListingWithSeller } from "@/types/database";

interface ListingsGridProps {
  listings: MarketplaceListingWithSeller[];
}

export function ListingsGrid({ listings }: ListingsGridProps) {
  if (listings.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No listings found.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or search query.
        </p>
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit, Eye, MessageSquare, Star, Trash2 } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { SWR_TIERS } from "@/lib/swr/config";
import { parseQueryResult } from "@/lib/schemas/parse";
import { MarketplaceListingSchema, type MarketplaceListingType } from "@/lib/schemas/marketplace";
import { LISTING_TYPE_MAP } from "@/lib/constants/marketplace";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clientError } from "@/lib/client-log";
import type { ListingStatus } from "@/types/database";

const STATUS_COLORS: Record<ListingStatus, string> = {
  active: "border-neon/30 bg-neon/10 text-neon",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  paused: "border-border/50 text-muted-foreground",
  sold_out: "border-red-500/30 bg-red-500/10 text-red-400",
  archived: "border-border/50 text-muted-foreground",
};

export function SellerListingsTable() {
  const { user } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceListingType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: listings = [], isLoading: loading, mutate } = useSWR<MarketplaceListingType[]>(
    user ? 'supabase:seller-listings' : null,
    async () => {
      const supabase = createClient();
      const response = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });

      if (response.error) throw response.error;
      return parseQueryResult(response, MarketplaceListingSchema, "MarketplaceListing");
    },
    { ...SWR_TIERS.MEDIUM }
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/marketplace/listings/${deleteTarget.slug}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete listing");
      }

      mutate(
        listings.filter((l) => l.id !== deleteTarget.id),
        false
      );
      setDeleteTarget(null);
    } catch {
      clientError("Failed to delete listing");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/50" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">You haven&apos;t created any listings yet.</p>
        <Link href="/sell" prefetch={false}>
          <Button className="mt-4 bg-neon text-background font-semibold hover:bg-neon/90">
            Create Your First Listing
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs text-right">Views</TableHead>
              <TableHead className="text-xs text-right">Inquiries</TableHead>
              <TableHead className="text-xs text-right">Rating</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => {
              const typeConfig = LISTING_TYPE_MAP[listing.listing_type as import("@/types/database").ListingType];
              return (
                <TableRow key={listing.id} className="border-border/30">
                  <TableCell>
                    <Link
                      href={`/marketplace/${listing.slug}`}
                      className="text-sm font-medium hover:text-neon transition-colors"
                    >
                      {listing.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] gap-1">
                      {typeConfig?.icon && <typeConfig.icon className="h-3 w-3" />}
                      {typeConfig?.shortLabel || listing.listing_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[11px]", STATUS_COLORS[listing.status as ListingStatus])}
                    >
                      {listing.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {listing.pricing_type === "free"
                      ? "Free"
                      : listing.pricing_type === "contact"
                        ? "Contact"
                        : formatCurrency(listing.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {listing.view_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {listing.inquiry_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {listing.avg_rating != null ? (
                      <div className="flex items-center justify-end gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        {listing.avg_rating.toFixed(1)}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/dashboard/seller/listings/${listing.slug}/edit`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-neon">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        onClick={() => setDeleteTarget(listing)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-background border-border/50">
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

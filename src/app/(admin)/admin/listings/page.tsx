"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { LISTING_TYPE_MAP } from "@/lib/constants/marketplace";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 20;
const supabase = createClient();

export default function AdminListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("marketplace_listings")
      .select("id, slug, title, listing_type, status, pricing_type, price, avg_rating, review_count, view_count, inquiry_count, is_featured, created_at, profiles!marketplace_listings_seller_id_fkey(display_name, username)", { count: "exact" });

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) {
      const safeSearch = sanitizeFilterValue(search);
      if (safeSearch) query = query.ilike("title", `%${safeSearch}%`);
    }

    query = query.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await query;
    setListings((data as any[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const { error } = await (supabase as any)
        .from("marketplace_listings")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Listing ${newStatus === "active" ? "activated" : "paused"}`);
      fetchListings();
    } catch {
      toast.error("Failed to update listing status");
    }
  };

  const toggleFeatured = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("marketplace_listings")
        .update({ is_featured: !currentValue })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentValue ? "Listing unfeatured" : "Listing featured");
      fetchListings();
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const removeListing = async (id: string) => {
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          target_type: "listing",
          target_id: id,
          reason: "Removed by admin",
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Listing removed");
      fetchListings();
    } catch {
      toast.error("Failed to remove listing");
    }
  };

  const restoreListing = async (id: string) => {
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          target_type: "listing",
          target_id: id,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Listing restored");
      fetchListings();
    } catch {
      toast.error("Failed to restore listing");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-neon" />
          Marketplace Listings ({totalCount})
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            defaultValue={search}
            onChange={(e) => {
              const value = e.target.value;
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                setSearch(value);
                setPage(1);
              }, 300);
            }}
            className="pl-9 bg-secondary"
          />
        </div>
        <div className="flex gap-1">
          {["all", "active", "draft", "paused", "archived"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={statusFilter === s ? "bg-neon text-background hover:bg-neon/90" : ""}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Listing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Seller</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Rating</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Views</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : listings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No listings found.
                  </td>
                </tr>
              ) : (
                listings.map((l) => {
                  const typeConfig = LISTING_TYPE_MAP[l.listing_type as keyof typeof LISTING_TYPE_MAP];
                  return (
                    <tr key={l.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/marketplace/${l.slug}`} className="text-sm font-medium hover:text-neon transition-colors">
                            {l.title}
                          </Link>
                          {l.is_featured && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {l.profiles?.display_name || l.profiles?.username || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className="text-[11px]"
                          style={typeConfig ? { borderColor: `${typeConfig.color}30`, color: typeConfig.color } : undefined}
                        >
                          {typeConfig?.shortLabel || l.listing_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">
                        {l.pricing_type === "free" ? (
                          <span className="text-gain">Free</span>
                        ) : l.pricing_type === "contact" ? (
                          <span className="text-muted-foreground">Contact</span>
                        ) : (
                          formatCurrency(l.price)
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums">
                        {l.avg_rating ? (
                          <span className="flex items-center justify-center gap-1">
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            {Number(l.avg_rating).toFixed(1)}
                            <span className="text-xs text-muted-foreground">({l.review_count})</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                        {formatNumber(l.view_count)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${
                            l.status === "active"
                              ? "border-gain/30 text-gain"
                              : l.status === "paused"
                                ? "border-amber-500/30 text-amber-500"
                                : l.status === "archived"
                                  ? "border-loss/30 text-loss"
                                  : "border-muted-foreground/30 text-muted-foreground"
                          }`}
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleFeatured(l.id, l.is_featured)}
                          >
                            {l.is_featured ? "Unfeature" : "Feature"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleStatus(l.id, l.status)}
                          >
                            {l.status === "active" ? "Pause" : "Activate"}
                          </Button>
                          {l.status === "archived" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-gain hover:text-gain"
                              onClick={() => restoreListing(l.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          ) : (
                            <ConfirmDialog
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-loss hover:text-loss"
                                >
                                  <Archive className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              }
                              title="Remove Listing"
                              description="Are you sure you want to remove this listing? It will be archived and can be restored later."
                              confirmLabel="Remove"
                              variant="destructive"
                              onConfirm={() => removeListing(l.id)}
                            />
                          )}
                          <Link href={`/marketplace/${l.slug}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2" aria-label={`View ${l.title}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Package,
  Pencil,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { formatCurrency, formatNumber } from "@/lib/format";
import { LISTING_TYPE_MAP } from "@/lib/constants/marketplace";
import { SWR_TIERS } from "@/lib/swr/config";

import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AdminListing {
  id: string;
  slug: string;
  title: string;
  listing_type: string;
  status: string;
  pricing_type: string;
  price: number | null;
  avg_rating: number | null;
  review_count: number;
  view_count: number;
  inquiry_count: number;
  is_featured: boolean;
  created_at: string;
  seller_id: string;
  profiles: { id: string; display_name: string | null; username: string | null } | null;
  policy_review?: {
    decision: string;
    label: string;
    review_status: string;
    created_at: string;
    content_risk_level: string;
    autonomy_risk_level: string;
    purchase_mode: string;
    autonomy_mode: string;
    reason_codes: string[];
  } | null;
}

interface ListingsResponse {
  data: AdminListing[];
  count: number;
}

const PAGE_SIZE = 20;

function formatPolicyValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminListingsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Build SWR key with page/status/search params
  const swrKey = (() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    params.set("page", String(page));
    return `/api/admin/listings?${params}`;
  })();

  const { data, isLoading: loading, mutate } = useSWR<ListingsResponse>(
    swrKey,
    { ...SWR_TIERS.MEDIUM }
  );

  const listings = data?.data ?? [];
  const totalCount = data?.count ?? 0;

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const listing = listings.find((l) => l.id === id);
      if (!listing) return;
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const res = await fetch(`/api/marketplace/listings/${listing.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(`Listing ${newStatus === "active" ? "activated" : "paused"}`);
      mutate();
    } catch {
      toast.error("Failed to update listing status");
    }
  };

  const toggleFeatured = async (id: string, currentValue: boolean) => {
    try {
      const listing = listings.find((l) => l.id === id);
      if (!listing) return;
      const res = await fetch(`/api/marketplace/listings/${listing.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: !currentValue }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(currentValue ? "Listing unfeatured" : "Listing featured");
      mutate();
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
      mutate();
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
      mutate();
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
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">No listings found</p>
                      <p className="text-xs text-muted-foreground/70">
                        {search ? "Try adjusting your search or filters" : "Listings will appear here once added"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                listings.map((l) => {
                  const typeConfig = LISTING_TYPE_MAP[l.listing_type as keyof typeof LISTING_TYPE_MAP];
                  return (
                    <tr key={l.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/marketplace/${l.slug}`} className="text-sm font-medium hover:text-neon transition-colors">
                              {l.title}
                            </Link>
                            {l.is_featured && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            )}
                            {l.policy_review ? (
                              <Badge
                                variant="outline"
                                className={
                                  l.policy_review.decision === "block"
                                    ? "border-loss/30 text-loss"
                                    : "border-amber-500/30 text-amber-500"
                                }
                              >
                                {l.policy_review.decision === "block" ? "Blocked" : "Review"}
                              </Badge>
                            ) : null}
                          </div>
                          {l.policy_review ? (
                            <p className="text-xs text-muted-foreground">
                              Content: {formatPolicyValue(l.policy_review.content_risk_level)} · Autonomy:{" "}
                              {formatPolicyValue(l.policy_review.autonomy_mode)}
                              {l.policy_review.reason_codes[0]
                                ? ` · Reason: ${formatPolicyValue(l.policy_review.reason_codes[0])}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {l.profiles?.display_name || l.profiles?.username || "\u2014"}
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
                        ) : "\u2014"}
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
                          <Link href={`/admin/listings/${l.slug}/edit`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-neon hover:text-neon" aria-label={`Edit ${l.title}`}>
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </Link>
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

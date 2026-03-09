"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Loader2, Save, Star, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LISTING_TYPES, PRICING_TYPE_LABELS } from "@/lib/constants/marketplace";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { parseQueryResultSingle } from "@/lib/schemas/parse";
import { MarketplaceListingSchema } from "@/lib/schemas/marketplace";
import { SWR_TIERS } from "@/lib/swr/config";
import { toast } from "sonner";
import { use } from "react";
import type { MarketplaceListingType } from "@/lib/schemas/marketplace";

type ListingType = "api_access" | "model_weights" | "fine_tuned_model" | "dataset" | "prompt_template";
type PricingType = "one_time" | "monthly_subscription" | "per_token" | "per_request" | "free" | "contact";
type StatusType = "active" | "paused" | "draft" | "archived" | "sold_out";

const STATUS_OPTIONS: { value: StatusType; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "border-neon/30 bg-neon/10 text-neon" },
  { value: "paused", label: "Paused", color: "border-border/50 text-muted-foreground" },
  { value: "draft", label: "Draft", color: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  { value: "archived", label: "Archived", color: "border-red-500/30 bg-red-500/10 text-red-400" },
];

export default function AdminEditListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [listingType, setListingType] = useState<ListingType>("api_access");
  const [pricingType, setPricingType] = useState<PricingType>("contact");
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState<StatusType>("active");
  const [isFeatured, setIsFeatured] = useState(false);

  // SWR for listing data with inline Supabase fetcher
  const { data: listing, error: loadError, isLoading: loading } = useSWR<MarketplaceListingType | null>(
    `supabase:admin-edit-listing:${slug}`,
    async () => {
      const supabase = createClient();
      const listingResponse = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("slug", slug)
        .single();

      return parseQueryResultSingle(listingResponse, MarketplaceListingSchema, "AdminEditListing");
    },
    { ...SWR_TIERS.SLOW }
  );

  // Populate form fields when listing data arrives
  useEffect(() => {
    if (listing) {
      setTitle(listing.title);
      setDescription(listing.description);
      setShortDescription(listing.short_description || "");
      setListingType(listing.listing_type as ListingType);
      setPricingType(listing.pricing_type as PricingType);
      setPrice(listing.price?.toString() || "");
      setTags(listing.tags?.join(", ") || "");
      setDemoUrl(listing.demo_url || "");
      setDocumentationUrl(listing.documentation_url || "");
      setThumbnailUrl(listing.thumbnail_url || "");
      setStatus(listing.status as StatusType);
      setIsFeatured(listing.is_featured || false);
    }
  }, [listing]);

  const showPriceInput = pricingType !== "free" && pricingType !== "contact";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!listing) {
      setError("Listing not loaded.");
      return;
    }

    setSubmitting(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/marketplace/listings/${listing.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          short_description: shortDescription.trim() || null,
          listing_type: listingType,
          pricing_type: pricingType,
          price: showPriceInput && price ? parseFloat(price) : pricingType === "free" ? 0 : null,
          tags: parsedTags,
          demo_url: demoUrl.trim() || null,
          documentation_url: documentationUrl.trim() || null,
          thumbnail_url: thumbnailUrl.trim() || null,
          status,
          is_featured: isFeatured,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update listing");
      }

      toast.success("Listing updated successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-secondary" />
        <div className="h-96 animate-pulse rounded-xl bg-secondary" />
      </div>
    );
  }

  if (loadError || !listing) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">{loadError ? "Failed to load listing" : "Listing not found"}</p>
        <Link href="/admin/listings">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Listings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/listings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold">Edit Listing</h2>
            <p className="text-xs text-muted-foreground">
              Admin editing — {listing.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/marketplace/${listing.slug}`} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-3 w-3" />
              View Live
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content — Left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="admin-listing-title" className="mb-1.5 block text-sm font-medium">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="admin-listing-title"
                    className="bg-secondary"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    required
                  />
                </div>

                {/* Short Description */}
                <div>
                  <label htmlFor="admin-listing-short-desc" className="mb-1.5 block text-sm font-medium">
                    Short Description
                  </label>
                  <Input
                    id="admin-listing-short-desc"
                    placeholder="One-line summary for listing cards"
                    className="bg-secondary"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    maxLength={300}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="admin-listing-desc" className="mb-1.5 block text-sm font-medium">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="admin-listing-desc"
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                {/* Tags */}
                <div>
                  <label htmlFor="admin-listing-tags" className="mb-1.5 block text-sm font-medium">
                    Tags
                  </label>
                  <Input
                    id="admin-listing-tags"
                    placeholder="comma-separated tags"
                    className="bg-secondary"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tags.split(",").filter((t) => t.trim()).length} tags
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* URLs Card */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="admin-demo-url" className="mb-1.5 block text-sm font-medium">
                      Demo / Signup URL
                    </label>
                    <Input
                      id="admin-demo-url"
                      type="url"
                      placeholder="https://..."
                      className="bg-secondary"
                      value={demoUrl}
                      onChange={(e) => setDemoUrl(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Affiliate / referral link</p>
                  </div>
                  <div>
                    <label htmlFor="admin-docs-url" className="mb-1.5 block text-sm font-medium">
                      Documentation URL
                    </label>
                    <Input
                      id="admin-docs-url"
                      type="url"
                      placeholder="https://..."
                      className="bg-secondary"
                      value={documentationUrl}
                      onChange={(e) => setDocumentationUrl(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="admin-thumb-url" className="mb-1.5 block text-sm font-medium">
                    Thumbnail URL
                  </label>
                  <Input
                    id="admin-thumb-url"
                    type="url"
                    placeholder="https://... (image URL)"
                    className="bg-secondary"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — Right 1/3 */}
          <div className="space-y-6">
            {/* Status & Featured */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <Badge
                      key={opt.value}
                      variant="outline"
                      className={cn(
                        "cursor-pointer text-xs transition-colors",
                        status === opt.value
                          ? opt.color
                          : "border-border/50 text-muted-foreground hover:border-neon/30"
                      )}
                      onClick={() => setStatus(opt.value)}
                    >
                      {opt.label}
                    </Badge>
                  ))}
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                    isFeatured
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-border/50 hover:border-amber-500/20"
                  )}
                  onClick={() => setIsFeatured(!isFeatured)}
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      isFeatured ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {isFeatured ? "Featured" : "Not Featured"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Featured listings appear first
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="admin-listing-type" className="mb-1.5 block text-sm font-medium">
                    Listing Type
                  </label>
                  <Select
                    value={listingType}
                    onValueChange={(v) => setListingType(v as ListingType)}
                  >
                    <SelectTrigger className="w-full bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LISTING_TYPES.map((lt) => (
                        <SelectItem key={lt.slug} value={lt.slug}>
                          {lt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="admin-pricing-type" className="mb-1.5 block text-sm font-medium">
                    Pricing Type
                  </label>
                  <Select
                    value={pricingType}
                    onValueChange={(v) => setPricingType(v as PricingType)}
                  >
                    <SelectTrigger className="w-full bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(PRICING_TYPE_LABELS) as [PricingType, string][]
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showPriceInput && (
                  <div>
                    <label htmlFor="admin-price" className="mb-1.5 block text-sm font-medium">
                      Price (USD)
                    </label>
                    <Input
                      id="admin-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="bg-secondary"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pricingType === "monthly_subscription" && "per month"}
                      {pricingType === "per_token" && "per 1M tokens"}
                      {pricingType === "per_request" && "per request"}
                      {pricingType === "one_time" && "one-time payment"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Views</span>
                  <span className="tabular-nums">{listing.view_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchases</span>
                  <span className="tabular-nums">{(listing as MarketplaceListingType & { purchase_count?: number }).purchase_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reviews</span>
                  <span className="tabular-nums">{listing.review_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model ID</span>
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                    {listing.model_id || "---"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-xs">{new Date(listing.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Submit Bar */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border/30 pt-4">
          <Link href="/admin/listings">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-neon text-background font-semibold hover:bg-neon/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

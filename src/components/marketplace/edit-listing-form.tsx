"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LISTING_TYPES, PRICING_TYPE_LABELS } from "@/lib/constants/marketplace";
import { cn } from "@/lib/utils";
import type { MarketplaceListing, ListingType, MarketplacePricingType, ListingStatus } from "@/types/database";

interface EditListingFormProps {
  listing: MarketplaceListing;
}

const STATUS_OPTIONS: { value: ListingStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "border-neon/30 bg-neon/10 text-neon" },
  { value: "paused", label: "Paused", color: "border-border/50 text-muted-foreground" },
  { value: "draft", label: "Draft", color: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
];

export function EditListingForm({ listing }: EditListingFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form fields
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [shortDescription, setShortDescription] = useState(listing.short_description || "");
  const [listingType, setListingType] = useState<ListingType>(listing.listing_type);
  const [pricingType, setPricingType] = useState<MarketplacePricingType>(listing.pricing_type);
  const [price, setPrice] = useState(listing.price?.toString() || "");
  const [tags, setTags] = useState(listing.tags?.join(", ") || "");
  const [demoUrl, setDemoUrl] = useState(listing.demo_url || "");
  const [documentationUrl, setDocumentationUrl] = useState(listing.documentation_url || "");
  const [status, setStatus] = useState<ListingStatus>(listing.status);

  const showPriceInput =
    pricingType !== "free" &&
    pricingType !== "contact";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (showPriceInput && price && parseFloat(price) < 0) {
      setError("Price must be a positive number.");
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
          price: showPriceInput && price ? parseFloat(price) : null,
          tags: parsedTags,
          demo_url: demoUrl.trim() || null,
          documentation_url: documentationUrl.trim() || null,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update listing");
      }

      setSuccess("Listing updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/marketplace/listings/${listing.slug}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete listing");
      }

      router.push("/marketplace/seller/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete listing");
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Edit Listing</CardTitle>
        <div className="flex items-center gap-2">
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
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., GPT-4 Fine-tuned for Medical Q&A"
              className="bg-secondary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Short Description
            </label>
            <Input
              placeholder="One-line summary shown in listing cards"
              className="bg-secondary"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={300}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Detailed description of what you're offering..."
              className="flex min-h-[160px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Type & Pricing Row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Listing Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={listingType}
                onValueChange={(v) => setListingType(v as ListingType)}
              >
                <SelectTrigger className="w-full bg-secondary">
                  <SelectValue placeholder="Select type..." />
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
              <label className="mb-2 block text-sm font-medium">
                Pricing Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={pricingType}
                onValueChange={(v) => setPricingType(v as MarketplacePricingType)}
              >
                <SelectTrigger className="w-full bg-secondary">
                  <SelectValue placeholder="Select pricing..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRICING_TYPE_LABELS) as [MarketplacePricingType, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price */}
          {showPriceInput && (
            <div>
              <label className="mb-2 block text-sm font-medium">Price (USD)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="bg-secondary"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {pricingType === "monthly_subscription" && "Price per month"}
                {pricingType === "per_token" && "Price per 1M tokens"}
                {pricingType === "per_request" && "Price per request"}
                {pricingType === "one_time" && "One-time payment"}
              </p>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="mb-2 block text-sm font-medium">Tags</label>
            <Input
              placeholder="e.g., medical, nlp, fine-tuned (comma-separated)"
              className="bg-secondary"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* URLs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Demo URL</label>
              <Input
                type="url"
                placeholder="https://demo.example.com"
                className="bg-secondary"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Documentation URL</label>
              <Input
                type="url"
                placeholder="https://docs.example.com"
                className="bg-secondary"
                value={documentationUrl}
                onChange={(e) => setDocumentationUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-neon/30 bg-neon/10 p-3">
              <p className="text-sm text-neon">{success}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-border/30 pt-4">
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Listing
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background border-border/50">
                <DialogHeader>
                  <DialogTitle>Delete Listing</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &ldquo;{listing.title}&rdquo;? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
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
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

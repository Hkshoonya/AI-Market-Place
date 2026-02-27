"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LISTING_TYPES, PRICING_TYPE_LABELS } from "@/lib/constants/marketplace";
import type { ListingType, MarketplacePricingType } from "@/types/database";

export function CreateListingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [listingType, setListingType] = useState<ListingType | "">("");
  const [pricingType, setPricingType] = useState<MarketplacePricingType | "">("");
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");

  const showPriceInput =
    pricingType !== "" &&
    pricingType !== "free" &&
    pricingType !== "contact";

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
    if (!listingType) {
      setError("Please select a listing type.");
      return;
    }
    if (!pricingType) {
      setError("Please select a pricing type.");
      return;
    }
    if (showPriceInput && (!price || parseFloat(price) < 0)) {
      setError("Please enter a valid price.");
      return;
    }

    setSubmitting(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          short_description: shortDescription.trim() || null,
          listing_type: listingType,
          pricing_type: pricingType,
          price: showPriceInput ? parseFloat(price) : null,
          tags: parsedTags.length > 0 ? parsedTags : [],
          demo_url: demoUrl.trim() || null,
          documentation_url: documentationUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create listing");
      }

      const data = await res.json();
      router.push(`/marketplace/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle>Create New Listing</CardTitle>
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
              placeholder="Detailed description of what you're offering, including features, use cases, and technical details..."
              className="flex min-h-[160px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Type & Pricing Row */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Listing Type */}
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

            {/* Pricing Type */}
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
              <label className="mb-2 block text-sm font-medium">
                Price (USD) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="bg-secondary"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
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
            <p className="mt-1 text-xs text-muted-foreground">
              Separate tags with commas to help buyers find your listing.
            </p>
          </div>

          {/* URLs Row */}
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

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 border-t border-border/30 pt-4">
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
                  Creating...
                </>
              ) : (
                "Create Listing"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

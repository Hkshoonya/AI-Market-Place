"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";
import type { MarketplaceListing } from "@/types/database";

interface ContactFormProps {
  listing: Pick<MarketplaceListing, "id" | "title" | "seller_id" | "pricing_type" | "price">;
}

export function ContactForm({ listing }: ContactFormProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const buttonLabel =
    listing.pricing_type === "contact"
      ? "Contact Seller"
      : listing.pricing_type === "free"
        ? "Request Access"
        : "Request Access";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Please include a message for the seller.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listing.id,
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send request");
      }

      setSubmitted(true);
      setMessage("");
      toast.success("Request sent to seller");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
      toast.error("Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      // Reset state when closing
      setMessage("");
      setError("");
      setSubmitted(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-neon hover:underline">
            Sign in
          </Link>{" "}
          to contact the seller.
        </p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full bg-neon text-background font-semibold hover:bg-neon/90">
          <MessageSquare className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border-border/50">
        <DialogHeader>
          <DialogTitle>{buttonLabel}</DialogTitle>
          <DialogDescription>
            Send a message to the seller about &ldquo;{listing.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neon/10">
              <CheckCircle className="h-6 w-6 text-neon" />
            </div>
            <h3 className="text-lg font-semibold">Request Sent!</h3>
            <p className="text-center text-sm text-muted-foreground">
              The seller has been notified. You&apos;ll receive a response once they review your request.
            </p>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="mt-2"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="contact-seller-message" className="mb-2 block text-sm font-medium">
                Your Message
              </label>
              <textarea
                id="contact-seller-message"
                placeholder="Introduce yourself and explain how you plan to use this listing..."
                className="flex min-h-[120px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                aria-label="Your message to the seller"
              />
            </div>

            {listing.pricing_type !== "free" && listing.pricing_type !== "contact" && listing.price != null && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Listed price:{" "}
                  <span className="font-medium text-foreground">
                    ${listing.price.toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-neon text-background font-semibold hover:bg-neon/90"
              >
                {submitting ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

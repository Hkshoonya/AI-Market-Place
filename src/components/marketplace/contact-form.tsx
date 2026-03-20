"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Send, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isGuest = !user;

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

    if (isGuest && (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()))) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const senderEmail =
        isGuest
          ? guestEmail.trim()
          : typeof user?.email === "string"
            ? user.email
            : "";
      const senderName =
        isGuest
          ? guestName.trim() || guestEmail.trim()
          : typeof user?.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user?.user_metadata?.name === "string"
              ? user.user_metadata.name
              : senderEmail || "Marketplace user";

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: senderName,
          email: senderEmail,
          category: "listing",
          subject: `Marketplace inquiry for ${listing.title}`,
          message: message.trim(),
          listing_id: listing.id,
          seller_id: listing.seller_id,
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
      setMessage("");
      setGuestEmail("");
      setGuestName("");
      setError("");
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="truncate">{buttonLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border-border/50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{buttonLabel}</DialogTitle>
          <DialogDescription className="break-words">
            Send a message to the seller about &ldquo;{listing.title}&rdquo;. The inquiry is stored on-platform so the seller can respond and support can investigate later if needed.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neon/10">
              <CheckCircle className="h-6 w-6 text-neon" />
            </div>
            <h3 className="text-lg font-semibold">Request Sent!</h3>
            <p className="text-center text-sm text-muted-foreground">
              The seller has been notified through the platform. You&apos;ll receive a response
              {isGuest ? ` at ${guestEmail || "your email"}` : " once they review your request"}.
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
            {/* Guest fields */}
            {isGuest && (
              <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Mail className="h-4 w-4" />
                  Your contact info
                </div>
                <div>
                  <label htmlFor="contact-guest-email" className="mb-1 block text-sm font-medium">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="contact-guest-email"
                    type="email"
                    placeholder="you@example.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-secondary px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="contact-guest-name" className="mb-1 block text-sm font-medium">
                    Name <span className="text-xs text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="contact-guest-name"
                    type="text"
                    placeholder="Your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-secondary px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            )}

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

            {error && <p className="text-sm text-red-500 break-words" role="alert">{error}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
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

            {isGuest && (
              <p className="text-center text-[11px] text-muted-foreground pt-1">
                Already have an account?{" "}
                <Link href="/login?redirect=/marketplace" className="text-neon hover:underline">
                  Sign in
                </Link>
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

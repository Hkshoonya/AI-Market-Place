"use client";

import Link from "next/link";
import { Mail, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface GuestCheckoutFormProps {
  sellerName?: string;
  guestEmail: string;
  setGuestEmail: (v: string) => void;
  guestName: string;
  setGuestName: (v: string) => void;
  error: string;
  purchasing: boolean;
  onPurchase: () => void;
  onCancel: () => void;
}

export function GuestCheckoutForm({
  sellerName,
  guestEmail,
  setGuestEmail,
  guestName,
  setGuestName,
  error,
  purchasing,
  onPurchase,
  onCancel,
}: GuestCheckoutFormProps) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10 shrink-0">
            <Mail className="h-5 w-5 text-neon" />
          </div>
          <div>
            <DialogTitle>Get Free Access</DialogTitle>
            <DialogDescription>No account required</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {sellerName && (
        <p className="text-sm text-muted-foreground">
          From <span className="text-foreground">{sellerName}</span>
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="guest-email" className="mb-1.5 block text-sm font-medium">
            Email address <span className="text-red-400">*</span>
          </label>
          <input
            id="guest-email"
            type="email"
            placeholder="you@example.com"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Delivery details will be sent to this email
          </p>
        </div>
        <div>
          <label htmlFor="guest-name" className="mb-1.5 block text-sm font-medium">
            Name <span className="text-muted-foreground text-xs">(optional)</span>
          </label>
          <input
            id="guest-name"
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={purchasing}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 bg-neon text-background hover:bg-neon/90"
          disabled={purchasing}
          onClick={onPurchase}
        >
          {purchasing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Get Access"
          )}
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login?redirect=/marketplace" className="text-neon hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

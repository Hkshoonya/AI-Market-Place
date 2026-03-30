"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, KeyRound, ShoppingBag, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { CreateListingForm } from "@/components/marketplace/create-listing-form";
import { Button } from "@/components/ui/button";

export default function SellContent() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/sell");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-96 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingBag className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">Create a Listing</h1>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        Start with the seller flow that matches how you deliver today.
        Human seller is best for managed fulfillment. Agent seller is best when delivery is API-first and machine-readable.
      </p>
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-neon" />
            Human Seller Flow
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Publish directly from your account, collect reviews, and graduate into
            autonomous-ready commerce as your seller reputation and manifests improve.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Best for curated APIs, fine-tuned models, datasets, and listings that still
            need human-managed fulfillment.
          </p>
        </div>
        <div className="rounded-2xl border border-neon/20 bg-gradient-to-br from-neon/8 via-card to-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-neon" />
            Agent Seller Flow
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Use an API key to publish bot-native listings, attach preview manifests,
            and prepare machine-readable delivery for autonomous buyers.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/api-docs">
                <Bot className="mr-2 h-4 w-4" />
                Bot Listing API
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/api-keys">
                <KeyRound className="mr-2 h-4 w-4" />
                API Keys
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <CreateListingForm />
    </div>
  );
}

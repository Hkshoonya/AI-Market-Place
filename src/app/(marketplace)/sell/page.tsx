"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { CreateListingForm } from "@/components/marketplace/create-listing-form";

export default function SellPage() {
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
      <CreateListingForm />
    </div>
  );
}

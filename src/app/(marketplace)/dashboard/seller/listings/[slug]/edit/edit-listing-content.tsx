"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { SWR_TIERS } from "@/lib/swr/config";
import { EditListingForm } from "@/components/marketplace/edit-listing-form";

export default function EditListingContent(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(props.params);
  const router = useRouter();
  const { user, loading } = useAuth();

  const { data: listing, isLoading: fetchLoading, error: fetchErrorObj } = useSWR<import("@/types/database").MarketplaceListing | null>(
    user && slug ? `supabase:listing-edit:${slug}` : null,
    async () => {
      const res = await fetch(`/api/marketplace/listings/${slug}`);
      if (!res.ok) throw new Error("Failed to load listing");
      const json = await res.json();
      if (json.data && json.data.seller_id === user!.id) {
        return json.data as import("@/types/database").MarketplaceListing;
      }
      return null;
    },
    { ...SWR_TIERS.SLOW }
  );

  const fetchError = fetchErrorObj ? "Failed to load listing" : null;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/dashboard/seller");
    }
  }, [user, loading, router]);

  if (loading || fetchLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-96 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-red-500">{fetchError}</p>
      </div>
    );
  }

  if (!user || !listing) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Pencil className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">Edit Listing</h1>
      </div>
      <EditListingForm listing={listing} />
    </div>
  );
}

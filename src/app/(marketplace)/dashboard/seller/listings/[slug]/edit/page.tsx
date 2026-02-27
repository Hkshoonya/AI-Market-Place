"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { EditListingForm } from "@/components/marketplace/edit-listing-form";

export default function EditListingPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(props.params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [listing, setListing] = useState<any>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/dashboard/seller");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && slug) {
      fetch(`/api/marketplace/listings/${slug}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data && res.data.seller_id === user.id) {
            setListing(res.data);
          }
          setFetchLoading(false);
        })
        .catch(() => setFetchLoading(false));
    }
  }, [user, slug]);

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

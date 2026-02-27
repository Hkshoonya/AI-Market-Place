"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function ViewTracker({ listingId }: { listingId: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    supabase
      .rpc("increment_view_count", { listing_id: listingId })
      .then(() => {})
      .catch(() => {
        // Fallback: direct update
        supabase
          .from("marketplace_listings")
          .update({ view_count: supabase.rpc ? undefined : 1 })
          .eq("id", listingId)
          .then(() => {});
      });
  }, [listingId]);

  return null;
}

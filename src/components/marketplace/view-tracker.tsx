"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { analytics } from "@/lib/posthog";

export function ViewTracker({ listingId, listingName }: { listingId: string; listingName?: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    analytics.listingViewed(listingId, listingName ?? "");

    const supabase = createClient();
    // increment_view_count is a database RPC not registered in the TypedSupabaseClient Functions type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("increment_view_count", { listing_id: listingId })
      .then(() => {})
      .catch(() => {
        console.warn("[view-tracker] Failed to record view");
      });
  }, [listingId, listingName]);

  return null;
}

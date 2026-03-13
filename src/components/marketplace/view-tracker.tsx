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
    void (async () => {
      const { error } = await supabase.rpc("increment_view_count", {
        listing_id: listingId,
      });
      if (error) {
        console.warn("[view-tracker] Failed to record view");
      }
    })();
  }, [listingId, listingName]);

  return null;
}

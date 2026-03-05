"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function ViewTracker({ listingId }: { listingId: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const supabase = createClient();
    // increment_view_count is a database RPC not registered in the TypedSupabaseClient Functions type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("increment_view_count", { listing_id: listingId })
      .then(() => {})
      .catch(() => {
        console.warn("[view-tracker] Failed to record view");
      });
  }, [listingId]);

  return null;
}

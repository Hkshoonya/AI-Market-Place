"use client";

import { useEffect, useRef } from "react";
import { analytics } from "@/lib/posthog";

export function ModelViewTracker({ modelId, modelName }: { modelId: string; modelName: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    analytics.modelViewed(modelId, modelName);
  }, [modelId, modelName]);

  return null;
}

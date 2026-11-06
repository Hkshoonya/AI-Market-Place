"use client";

import useSWR from "swr";
import { Activity } from "lucide-react";
import { fetchServiceStatus, SERVICE_STATUS_URL } from "@/lib/service-status";

export function ServiceStatusBanner() {
  const { data } = useSWR("independent-service-status", fetchServiceStatus, {
    refreshInterval: 60_000, dedupingInterval: 30_000,
    refreshWhenHidden: false, shouldRetryOnError: false,
  });

  if (data?.state !== "interrupted") return null;

  return (
    <aside role="status" aria-live="polite" className="relative z-20 border-b border-amber-400/20 bg-amber-400/10 px-4 py-3">
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-start gap-x-3 gap-y-2 text-sm">
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <p className="min-w-0 flex-1 basis-64 leading-6">
          <strong className="font-semibold text-amber-200">Some services are temporarily unavailable.</strong>{" "}
          <span className="text-foreground/80">Live data and sign-in may be affected. Please try again shortly.</span>
        </p>
        <a href={SERVICE_STATUS_URL} target="_blank" rel="noopener noreferrer"
          className="shrink-0 rounded text-amber-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
          Service status
        </a>
      </div>
    </aside>
  );
}

"use client";

import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICE_STATUS_URL } from "@/lib/service-status";

export { SERVICE_STATUS_URL } from "@/lib/service-status";

export function ServiceInterruption({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-labelledby="service-interruption-heading"
      className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-12 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-neon/20 bg-neon/10">
        <Activity className="h-8 w-8 text-neon" aria-hidden="true" />
      </div>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-neon">AI Market Cap</p>
      <h1 id="service-interruption-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Temporarily unavailable
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        We&apos;re having trouble loading this page. Live data or sign-in services may be temporarily
        interrupted. Please try again shortly.
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        If a payment or submission timed out, check its status before submitting it again.
      </p>
      <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Button onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try loading again
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <a href={SERVICE_STATUS_URL} target="_blank" rel="noopener noreferrer">
            Service status
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">Please do not refresh repeatedly while services recover.</p>
    </section>
  );
}

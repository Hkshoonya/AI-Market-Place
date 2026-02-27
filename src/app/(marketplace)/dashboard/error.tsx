"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Dashboard Error</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn&apos;t load the dashboard. Please try again.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground/50 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button onClick={reset} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/marketplace">
            <LayoutDashboard className="h-4 w-4" />
            Marketplace
          </Link>
        </Button>
      </div>
    </div>
  );
}

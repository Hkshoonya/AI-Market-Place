"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground/50 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <Button
        onClick={reset}
        variant="outline"
        size="sm"
        className="mt-6 gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

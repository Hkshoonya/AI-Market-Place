"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ServiceInterruption } from "./service-interruption";

export interface RouteServiceErrorProps {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}

export default function RouteServiceError({ error, retry, reset }: RouteServiceErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  // Next's retry re-fetches server content; reset alone can retain failed data.
  return <ServiceInterruption onRetry={retry ?? reset ?? (() => window.location.reload())} />;
}

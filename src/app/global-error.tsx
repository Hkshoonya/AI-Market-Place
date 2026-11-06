"use client";

import RouteServiceError, { type RouteServiceErrorProps } from "@/components/shared/route-service-error";
import "./globals.css";

export default function GlobalError(props: RouteServiceErrorProps) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground">
        <title>Service temporarily unavailable | AI Market Cap</title>
        <RouteServiceError {...props} />
      </body>
    </html>
  );
}

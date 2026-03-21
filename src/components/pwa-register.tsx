"use client";

import { useEffect } from "react";
import { clientWarn } from "@/lib/client-log";

export function PWARegister() {
  useEffect(() => {
    let cancelled = false;

    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          if (!cancelled) {
            void registration.update().catch((err) => {
              clientWarn("[pwa-register] SW update check failed:", err);
            });
          }
        })
        .catch((err) => {
          clientWarn("[pwa-register] SW registration failed:", err);
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

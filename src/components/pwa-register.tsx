"use client";

import { useEffect } from "react";
import { clientWarn } from "@/lib/client-log";

export function PWARegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => {
          clientWarn("[pwa-register] SW registration failed:", err);
        });
    }
  }, []);

  return null;
}

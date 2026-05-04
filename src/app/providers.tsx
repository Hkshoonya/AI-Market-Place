"use client";

import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { jsonFetcher } from "@/lib/swr/fetcher";
import type { PostHog } from "posthog-js";

function derivePostHogUiHost(apiHost: string): string {
  try {
    const url = new URL(apiHost);

    if (url.hostname.endsWith(".i.posthog.com")) {
      url.hostname = url.hostname.replace(".i.posthog.com", ".posthog.com");
    }

    return url.origin;
  } catch {
    return "https://us.posthog.com";
  }
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    import("posthog-js").then(({ default: posthog }) => {
      let url = window.origin + pathname;
      const search = searchParams.toString();
      if (search) url += "?" + search;
      posthog.capture("$pageview", { $current_url: url });
    });
  }, [pathname, searchParams]);

  return null;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    import("posthog-js").then(({ default: posthog }) => {
      const posthogHost =
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: posthogHost,
        ui_host: derivePostHogUiHost(posthogHost),
        capture_pageview: false,
        capture_pageleave: true,
        person_profiles: "always",
        persistence: "localStorage+cookie",
      });
      setClient(posthog);
    });
  }, []);

  if (!client) return <>{children}</>;

  return (
    <PostHogProvider client={client}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: jsonFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
          // Never retry on 4xx client errors — they won't succeed on retry
          const status = (error as Error & { status?: number }).status;
          if (status && status >= 400 && status < 500) return;

          // Stop after 3 retries
          if (retryCount >= 3) return;

          // Exponential backoff: 2s, 4s, 8s
          setTimeout(() => revalidate({ retryCount }), 2000 * 2 ** retryCount);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

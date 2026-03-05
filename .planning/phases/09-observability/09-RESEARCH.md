# Phase 9: Observability - Research

**Researched:** 2026-03-05
**Domain:** Error tracking (Sentry) + Product analytics (PostHog) for Next.js 16 App Router
**Confidence:** HIGH

## Summary

Phase 9 integrates two observability tools into an existing Next.js 16 App Router application: Sentry for error tracking (server + client) and PostHog for product analytics. The codebase already has a centralized error handler (`handleApiError`) that covers all API routes, and 13 `error.tsx` boundary files with identical `console.error` patterns -- making instrumentation systematic.

The key technical decisions are already locked: errors-only Sentry (no tracing, no replay), PostHog with manual pageview tracking and 5-10 custom events, eager-loaded SDKs, source maps uploaded during Docker build. Research confirms these are sound choices. The combined bundle impact of `@sentry/nextjs` (errors-only, tree-shaken) + `posthog-js` (no replay) is approximately 30-55KB gzipped, well within the project's tolerance given the existing three.js bundle (~600KB).

**Primary recommendation:** Follow the Sentry manual setup pattern (4 config files + withSentryConfig wrapper) and the PostHog App Router provider pattern (provider component + pageview tracker component), both of which are well-documented and stable for Next.js 16.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sentry: Errors only, no performance tracing
- Instrument handleApiError in src/lib/api-error.ts -- single change covers all 68 API routes
- Instrument all 13 error.tsx files -- replace console.error with Sentry.captureException
- Upload source maps during Docker build Stage 2 (builder) -- requires SENTRY_AUTH_TOKEN as build arg in Coolify
- Include setup guide for creating Sentry project and configuring DSN as env var
- PostHog key actions only (5-10 high-value events): model_viewed, model_compared, listing_viewed, auction_bid, lens_switched, search_performed
- US cloud region (us.posthog.com)
- Identify logged-in users via posthog.identify(userId) after auth
- No session replay
- Auto-capture page views disabled; manual pageview tracking for App Router
- Only capture 5xx (unexpected) errors to Sentry -- 4xx are expected noise
- Tag errors with: source route name + authenticated user ID (if available)
- No request body or query params in Sentry context (PII risk)
- Eager load both SDKs -- no lazy loading needed
- Tree-shake aggressively (no replay, no tracing modules)

### Claude's Discretion
- Bundle size monitoring approach (manual check vs documented baseline)
- Exact PostHog event property schemas
- Sentry environment/release tag naming convention
- Whether to add a PostHog opt-out mechanism (cookie banner)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OBS-01 | Sentry SDK integrated with automatic exception capture on all 65 API routes via handleApiError | handleApiError is a single integration point; add Sentry.captureException for non-ApiError (5xx) errors. Sentry server config via sentry.server.config.ts + instrumentation.ts |
| OBS-02 | Sentry source maps uploaded during Docker build for readable stack traces | withSentryConfig in next.config.ts handles upload; SENTRY_AUTH_TOKEN as Docker build arg; deleteSourcemapsAfterUpload prevents public exposure |
| OBS-03 | PostHog client-side SDK tracks page views and user identification | PostHogProvider wraps layout.tsx; PostHogPageView component uses usePathname/useSearchParams for App Router manual pageview tracking; posthog.identify in auth-provider.tsx |
| OBS-04 | PostHog custom events capture key user actions (model view, comparison, marketplace interaction) | posthog.capture() calls at specific interaction points; usePostHog hook for component access |
| OBS-05 | CSP headers updated in next.config.ts to allow Sentry and PostHog domains | connect-src needs *.ingest.sentry.io and us.i.posthog.com; script-src needs us.posthog.com for autocapture |
| PERF-03 | Bundle impact of Sentry + PostHog kept under control via tree-shaking and lazy loading | Tree-shake via bundleSizeOptimizations: excludeTracing + excludeDebugStatements; PostHog lazy-loads replay by default; combined ~30-55KB gzipped |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sentry/nextjs | ^10.42.0 | Error tracking (server + client + edge) | Official Sentry SDK for Next.js; handles instrumentation.ts, webpack plugin, source map upload |
| posthog-js | latest | Client-side product analytics | Official PostHog JS SDK; tree-shakeable, lazy-loads replay by default |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| posthog-js/react | (included) | React hooks and provider | PostHogProvider, usePostHog hook for components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentry | LogRocket, Datadog | Sentry is free tier generous (5K errors/mo), purpose-built for error tracking |
| PostHog | Mixpanel, Amplitude | PostHog has generous free tier (1M events/mo), self-hostable if needed later |

**Installation:**
```bash
npm install @sentry/nextjs posthog-js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── instrumentation.ts          # Sentry server/edge registration
├── instrumentation-client.ts   # Sentry client init
├── sentry.server.config.ts     # Sentry server SDK config
├── sentry.edge.config.ts       # Sentry edge SDK config
├── app/
│   ├── global-error.tsx        # Sentry global error boundary
│   ├── layout.tsx              # PostHogProvider wraps children
│   └── providers.tsx           # NEW: PostHog provider + pageview tracker
├── lib/
│   ├── api-error.ts            # MODIFIED: add Sentry.captureException
│   └── posthog.ts              # NEW: PostHog event helpers
└── components/
    └── auth/
        └── auth-provider.tsx   # MODIFIED: add posthog.identify/reset
```

### Pattern 1: Sentry Server-Side Setup (4 files)

**What:** Sentry requires 4 configuration files for full Next.js App Router coverage.

**instrumentation.ts** (project root):
```typescript
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**sentry.server.config.ts** (project root):
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // No tracing -- errors only
  tracesSampleRate: 0,
  // No debug logging in production
  debug: false,
});
```

**sentry.edge.config.ts** (project root):
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
});
```

**instrumentation-client.ts** (project root):
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // No tracing, no replay
  tracesSampleRate: 0,
  integrations: [],
  // No replay sample rates
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
```

### Pattern 2: handleApiError Integration (5xx only)

**What:** Add Sentry.captureException to the existing centralized error handler, only for unexpected (5xx) errors.

```typescript
import { systemLog } from "@/lib/logging";
import * as Sentry from "@sentry/nextjs";

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function handleApiError(error: unknown, source: string): Response {
  if (error instanceof ApiError) {
    // 4xx errors -- expected, don't send to Sentry
    void systemLog.warn(source, error.message, { statusCode: error.statusCode });
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // 5xx errors -- unexpected, capture in Sentry
  Sentry.captureException(error, {
    tags: { source },
  });
  void systemLog.error(source, "Unexpected error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

### Pattern 3: PostHog Provider + Pageview Tracker

**What:** PostHog requires a client-side provider and a manual pageview tracker for App Router.

**src/app/providers.tsx:**
```typescript
"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { usePostHog } from "posthog-js/react";

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    capture_pageview: false, // Manual tracking for App Router
    capture_pageleave: true,
    person_profiles: "always",
    persistence: "localStorage+cookie",
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + "?" + searchParams.toString();
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
```

### Pattern 4: PostHog User Identification in AuthProvider

**What:** Link anonymous PostHog sessions to authenticated users when auth state changes.

```typescript
// In auth-provider.tsx onAuthStateChange callback:
import posthog from "posthog-js";

// After user signs in:
if (currentUser) {
  posthog.identify(currentUser.id, {
    email: currentUser.email,
  });
}

// After user signs out:
posthog.reset();
```

### Pattern 5: PostHog Custom Event Tracking

**What:** Fire-and-forget custom events at key interaction points.

```typescript
import { usePostHog } from "posthog-js/react";

// In a component:
const posthog = usePostHog();
posthog.capture("model_viewed", {
  model_id: model.id,
  model_name: model.name,
});
```

### Pattern 6: next.config.ts with withSentryConfig

**What:** Wrap existing config with Sentry's webpack plugin for source map upload and tree-shaking.

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // ... existing config
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,

  // Source maps
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tree-shaking: remove tracing and debug code
  bundleSizeOptimizations: {
    excludeTracing: true,
    excludeDebugStatements: true,
  },
});
```

### Pattern 7: CSP Header Updates

**What:** Add Sentry and PostHog domains to Content-Security-Policy.

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://us.i.posthog.com;
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.posthog.com;
```

### Anti-Patterns to Avoid
- **Capturing 4xx errors in Sentry:** Creates massive noise; 404s alone could exhaust free tier quota. Only capture unexpected (5xx) errors.
- **Using capture_pageview: true with App Router:** Fires on initial load only, misses client-side navigations. Must use manual tracking with usePathname.
- **Putting SENTRY_AUTH_TOKEN in runtime env vars:** It's a build-time secret only needed for source map upload. Pass as Docker build arg, not runtime env.
- **Including replay/tracing integrations "just in case":** Adds 30-100KB+ to bundle for unused features. Explicitly exclude them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source map upload | Custom CI script to upload .map files | withSentryConfig sourcemaps option | Handles versioning, cleanup, authentication automatically |
| Pageview tracking in SPA | Custom history listener | PostHog usePathname pattern | Handles edge cases (search params, hash changes, Suspense boundaries) |
| Error boundary integration | Custom error reporting fetch calls | Sentry.captureException in error.tsx | Includes stack traces, breadcrumbs, deduplication, rate limiting |
| User session linking | Custom session ID management | posthog.identify / posthog.reset | Handles anonymous-to-identified merge, cross-device |

**Key insight:** Both Sentry and PostHog have mature Next.js App Router integrations. The SDK handles edge cases (SSR vs client, streaming, Suspense boundaries) that would be extremely difficult to handle in custom code.

## Common Pitfalls

### Pitfall 1: Source Maps Exposed Publicly
**What goes wrong:** Next.js generates source maps and they end up served to browsers, exposing source code.
**Why it happens:** `productionBrowserSourceMaps` defaults to true when Sentry is configured.
**How to avoid:** Use `sourcemaps.deleteSourcemapsAfterUpload: true` in withSentryConfig. This uploads maps to Sentry then deletes them from the build output.
**Warning signs:** `.map` files visible in browser DevTools network tab.

### Pitfall 2: PostHog Pageview Double-Firing
**What goes wrong:** Pageviews fire twice on initial load.
**Why it happens:** React strict mode in development causes double useEffect execution. Or `capture_pageview: true` combined with manual tracking.
**How to avoid:** Set `capture_pageview: false` in PostHog init. The manual PostHogPageView component handles all tracking.
**Warning signs:** PostHog dashboard shows exactly 2x expected pageviews.

### Pitfall 3: SENTRY_AUTH_TOKEN Missing During Docker Build
**What goes wrong:** Source maps don't upload; Sentry shows minified stack traces.
**Why it happens:** Docker build args must be explicitly passed. Coolify env vars are runtime, not build-time by default.
**How to avoid:** In Coolify, configure SENTRY_AUTH_TOKEN as a build argument (not just runtime env). In Dockerfile: `ARG SENTRY_AUTH_TOKEN` before `RUN npm run build`.
**Warning signs:** Sentry errors show minified function names like `a.b.c` instead of readable names.

### Pitfall 4: CSP Blocking PostHog/Sentry Requests
**What goes wrong:** Analytics and error reports silently fail. No data appears in dashboards.
**Why it happens:** Existing CSP headers don't include third-party domains.
**How to avoid:** Add both domains to connect-src. Add PostHog to script-src if using autocapture.
**Warning signs:** Browser console shows CSP violation errors mentioning posthog.com or sentry.io.

### Pitfall 5: PostHog Suspense Boundary Missing
**What goes wrong:** `useSearchParams()` in PostHogPageView causes a build error or hydration mismatch.
**Why it happens:** Next.js App Router requires components using useSearchParams to be wrapped in Suspense.
**How to avoid:** Wrap PostHogPageView in `<Suspense fallback={null}>` inside the provider.
**Warning signs:** Build error: "useSearchParams() should be wrapped in a suspense boundary."

### Pitfall 6: Sentry withSentryConfig Breaks Turbopack Dev
**What goes wrong:** `next dev --turbopack` fails or shows warnings about Sentry webpack plugin.
**Why it happens:** Sentry's webpack plugin doesn't run during Turbopack builds. This is expected behavior.
**How to avoid:** This is fine -- Sentry SDK still initializes for error capture. Source map upload only matters for production builds (webpack).
**Warning signs:** Console warnings about Sentry plugin during dev; can be safely ignored.

## Code Examples

### error.tsx Sentry Integration (all 13 files)
```typescript
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
      <Button onClick={reset} variant="outline" size="sm" className="mt-6 gap-2">
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}
```

### global-error.tsx (new file required by Sentry)
```typescript
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

### PostHog Custom Event Helper (recommended)
```typescript
// src/lib/posthog.ts
import posthog from "posthog-js";

export const analytics = {
  modelViewed: (modelId: string, modelName: string) =>
    posthog.capture("model_viewed", { model_id: modelId, model_name: modelName }),

  modelCompared: (modelIds: string[]) =>
    posthog.capture("model_compared", { model_ids: modelIds, count: modelIds.length }),

  listingViewed: (listingId: string, listingName: string) =>
    posthog.capture("listing_viewed", { listing_id: listingId, listing_name: listingName }),

  auctionBid: (auctionId: string, amount: number) =>
    posthog.capture("auction_bid", { auction_id: auctionId, bid_amount: amount }),

  lensSwitched: (fromLens: string, toLens: string) =>
    posthog.capture("lens_switched", { from_lens: fromLens, to_lens: toLens }),

  searchPerformed: (query: string, resultCount: number) =>
    posthog.capture("search_performed", { query_length: query.length, result_count: resultCount }),
};
```

### Dockerfile Stage 2 with Source Map Upload
```dockerfile
# -- Stage 2: Build the application --
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Sentry source map upload requires auth token at build time
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

RUN npm run build
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sentry.client.config.ts + sentry.server.config.ts | instrumentation-client.ts + instrumentation.ts + sentry.server.config.ts | Sentry SDK v8 (2024) | Uses Next.js native instrumentation hook |
| @sentry/nextjs v7 (webpack only) | @sentry/nextjs v10 (webpack + Turbopack experimental) | 2025 | Better Next.js 15/16 compatibility |
| PostHog capture_pageview: true | Manual pageview tracking with usePathname | App Router adoption | Required for client-side navigation tracking |
| bundleSizeOptimizations.excludeTracing | Replaces older __SENTRY_TRACING__ define | Sentry SDK v10 | Cleaner API for tree-shaking |

**Deprecated/outdated:**
- `sentry.client.config.ts`: Replaced by `instrumentation-client.ts` in SDK v8+
- `__SENTRY_DEBUG__` / `__SENTRY_TRACING__` webpack defines: Replaced by `bundleSizeOptimizations` config
- `hideSourceMaps` option: Replaced by `sourcemaps.deleteSourcemapsAfterUpload`

## Discretion Recommendations

### Bundle Size Monitoring
**Recommendation:** Document baseline bundle size in the setup guide. Use `npx next build` output which shows route sizes. No automated monitoring needed at this scale -- manual check during Phase 16 simplification pass is sufficient.

### PostHog Event Property Schemas
**Recommendation:** Use the typed analytics helper (see Code Examples above). Properties should be snake_case, use IDs not names for joins, and avoid PII. Include `query_length` instead of raw query text for search events.

### Sentry Environment/Release Naming
**Recommendation:**
- Environment: Use `process.env.NODE_ENV` directly ("development", "production")
- Release: Use `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` or set `SENTRY_RELEASE` to git SHA in Coolify build args. Format: `aimarketcap@{git-sha-short}`

### PostHog Opt-Out Mechanism
**Recommendation:** Skip for now. The site doesn't appear to target EU users specifically, and PostHog's default behavior respects Do Not Track. If needed later, PostHog provides `posthog.opt_out_capturing()` and `posthog.opt_in_capturing()` methods. A cookie banner can be added in a future phase.

## Open Questions

1. **Next.js 16 + Sentry instrumentation.ts compatibility**
   - What we know: Sentry v10 supports Next.js 16. instrumentation.ts is a stable Next.js API.
   - What's unclear: Whether Next.js 16.1.6 specifically has any edge cases with onRequestError hook.
   - Recommendation: Proceed with standard setup; if onRequestError fails, fall back to handleApiError-only coverage (which already covers all API routes).

2. **Existing instrumentation.ts file**
   - What we know: The project may or may not already have an instrumentation.ts file.
   - What's unclear: Need to check at implementation time.
   - Recommendation: If it exists, merge Sentry registration into it. If not, create it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | handleApiError calls Sentry.captureException for 5xx errors only | unit | `npx vitest run src/lib/api-error.test.ts -t "sentry"` | No -- Wave 0 |
| OBS-02 | withSentryConfig sourcemaps config is correct | manual-only | Visual verification in Sentry dashboard after deploy | N/A |
| OBS-03 | PostHog provider initializes and pageview tracker fires | manual-only | Visual verification in PostHog dashboard | N/A |
| OBS-04 | PostHog custom events have correct properties | unit | `npx vitest run src/lib/posthog.test.ts` | No -- Wave 0 |
| OBS-05 | CSP headers include Sentry and PostHog domains | unit | `npx vitest run src/lib/csp.test.ts` | No -- Wave 0 |
| PERF-03 | Bundle size stays reasonable | manual-only | `npx next build` output inspection | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `src/lib/api-error.test.ts` -- test that Sentry.captureException is called for non-ApiError, not called for ApiError (covers OBS-01)
- [ ] `src/lib/posthog.test.ts` -- test that analytics helper calls posthog.capture with correct event names and properties (covers OBS-04)
- [ ] CSP header validation can be a simple string-includes test on the CSP value (covers OBS-05)

## Sources

### Primary (HIGH confidence)
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) -- instrumentation files, withSentryConfig, global-error.tsx
- [Sentry Next.js Build Options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/) -- sourcemaps config, bundleSizeOptimizations
- [Sentry Next.js Tree Shaking](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/tree-shaking/) -- excludeTracing, excludeDebugStatements
- [PostHog Next.js App Router Tutorial](https://posthog.com/tutorials/nextjs-app-directory-analytics) -- provider, pageview tracking, identify
- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js) -- official setup guide

### Secondary (MEDIUM confidence)
- [@sentry/nextjs npm](https://www.npmjs.com/package/@sentry/nextjs) -- version 10.42.0 confirmed
- [posthog-js Bundlephobia](https://bundlephobia.com/package/posthog-js) -- ~52KB gzipped core
- [Sentry bundle size reduction blog](https://blog.sentry.io/javascript-sdk-package-reduced/) -- bundle optimization context

### Tertiary (LOW confidence)
- Bundle size estimates (30-55KB combined gzipped) are approximate based on multiple sources; actual measurement needed after integration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- both SDKs have official Next.js guides, v10 Sentry confirmed for Next.js 16
- Architecture: HIGH -- patterns directly from official documentation, verified against project's existing code
- Pitfalls: HIGH -- well-documented issues with established solutions

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable SDKs, 30-day validity)

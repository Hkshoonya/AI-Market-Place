import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  async headers() {
    // In E2E test mode, extend connect-src to include localhost:54321 (Supabase mock).
    // This prevents CSP violations when client-side code tries to fetch from the
    // local Supabase URL injected via NEXT_PUBLIC_SUPABASE_URL during tests.
    const isE2E = process.env.NEXT_PUBLIC_E2E_MSW === "true";
    const connectSrc = isE2E
      ? "connect-src 'self' http://localhost:54321 ws://localhost:54321 https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://us.i.posthog.com;"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://us.i.posthog.com;";

    return [
      {
        // Cache static assets aggressively
        source: "/:path*.(ico|svg|png|jpg|jpeg|webp|gif|woff|woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Service worker must not be cached
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // CSP: allow self, Supabase, Sentry, PostHog, inline styles (needed for Next.js)
            // TODO: remove 'unsafe-eval' when moving to production (needed for dev hot-reload)
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co https://api.dicebear.com; font-src 'self'; ${connectSrc} frame-ancestors 'none';`,
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  bundleSizeOptimizations: {
    excludeTracing: true,
    excludeDebugStatements: true,
  },
});

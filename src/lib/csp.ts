interface ContentSecurityPolicyOptions {
  isDevelopment: boolean;
  isE2E: boolean;
}

export function buildContentSecurityPolicy({
  isDevelopment,
  isE2E,
}: ContentSecurityPolicyOptions): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    "https://us.posthog.com",
    "https://static.cloudflareinsights.com",
  ];

  const connectSrc = [
    "'self'",
    ...(isE2E ? ["http://localhost:54321", "ws://localhost:54321"] : []),
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.ingest.sentry.io",
    "https://us.i.posthog.com",
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.supabase.co https://api.dicebear.com",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];

  return `${directives.join("; ")};`;
}

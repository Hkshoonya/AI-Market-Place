interface ContentSecurityPolicyOptions {
  isDevelopment: boolean;
  isE2E: boolean;
  supabaseUrl?: string;
}

export function buildContentSecurityPolicy({
  isDevelopment,
  isE2E,
  supabaseUrl,
}: ContentSecurityPolicyOptions): string {
  let backendOrigins: string[] = [];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol === "https:" && url.username === "" && url.password === "" && url.port === "") {
        backendOrigins = [url.origin, `wss://${url.host}`];
      }
    } catch {
      // An invalid setting must never broaden the browser's connection policy.
    }
  }
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    "https://*.posthog.com",
    "https://static.cloudflareinsights.com",
  ];

  const connectSrc = [
    "'self'",
    ...backendOrigins,
    ...(isE2E ? ["http://localhost:54321", "ws://localhost:54321"] : []),
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.ingest.sentry.io",
    "https://*.i.posthog.com",
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];

  return `${directives.join("; ")};`;
}

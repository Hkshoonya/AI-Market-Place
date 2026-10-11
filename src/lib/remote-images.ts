type RemoteImagePattern = {
  protocol: "https";
  hostname: string;
  port: string;
  pathname: string;
};

export function getRemoteImagePatterns(supabaseUrl?: string): RemoteImagePattern[] {
  const patterns: RemoteImagePattern[] = [
    { protocol: "https", hostname: "api.dicebear.com", port: "", pathname: "/**" },
  ];

  if (!supabaseUrl) return patterns;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return patterns;
    }
    // Never optimize arbitrary tenants' uploads via a shared Supabase wildcard.
    patterns.push({
      protocol: "https",
      hostname: url.hostname,
      port: "",
      pathname: "/storage/v1/**",
    });
  } catch {
    // Missing or invalid configuration must not broaden the image allowlist.
  }
  return patterns;
}

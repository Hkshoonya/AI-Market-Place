import "server-only";

import { BlockList, isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
]);

const reservedIpv4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  reservedIpv4.addSubnet(address, prefix, "ipv4");
}

const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");
const reservedIpv6 = new BlockList();
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) {
  reservedIpv6.addSubnet(address, prefix, "ipv6");
}

function isNonPublicIpv4(hostname: string) {
  return reservedIpv4.check(hostname, "ipv4");
}

function isNonPublicIpv6(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  // Only native global unicast, excluding special-purpose and transition ranges.
  return !globalIpv6.check(normalized, "ipv6") || reservedIpv6.check(normalized, "ipv6");
}

export function isPublicAffiliateAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return !isNonPublicIpv4(normalized);
  if (ipVersion === 6) return !isNonPublicIpv6(normalized);
  return false;
}

export function parseSafeAffiliateDestination(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Destination must be a valid absolute URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Affiliate destinations must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Affiliate destinations cannot contain URL credentials");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Affiliate destinations cannot use a custom port");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Affiliate destination host is not public");
  }

  const ipVersion = isIP(hostname);
  if (
    (ipVersion === 4 && isNonPublicIpv4(hostname)) ||
    (ipVersion === 6 && isNonPublicIpv6(hostname))
  ) {
    throw new Error("Affiliate destination cannot use a private or reserved address");
  }

  return url;
}

export function sanitizeAffiliateSource(value: string | null) {
  const normalized = (value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "unknown";
}

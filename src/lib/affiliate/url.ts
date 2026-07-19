import "server-only";

import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
]);

function isNonPublicIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 31) ||
    (a === 192 && b === 52) ||
    (a === 192 && b === 88) ||
    (a === 192 && b === 175) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isNonPublicIpv6(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const mappedIpv4 = normalized.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isNonPublicIpv4(mappedIpv4);

  return (
    normalized.startsWith("::") ||
    normalized.startsWith("64:ff9b:") ||
    normalized.startsWith("100:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fec") ||
    normalized.startsWith("fed") ||
    normalized.startsWith("fee") ||
    normalized.startsWith("fef") ||
    normalized.startsWith("ff")
  );
}

export function isPublicAffiliateAddress(address: string) {
  const ipVersion = isIP(address.replace(/^\[|\]$/g, ""));
  if (ipVersion === 4) return !isNonPublicIpv4(address);
  if (ipVersion === 6) return !isNonPublicIpv6(address);
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

import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/constants/site";

function isLoopbackOrigin(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")
    );
  } catch {
    return false;
  }
}

function getTrustedOrigins(request: Request) {
  const canonicalOrigin = new URL(SITE_URL).origin;
  const trusted = new Set([canonicalOrigin]);

  if (canonicalOrigin === "https://aimarketcap.tech") {
    trusted.add("https://www.aimarketcap.tech");
  }

  if (process.env.NODE_ENV !== "production") {
    const requestOrigin = new URL(request.url).origin;
    if (isLoopbackOrigin(requestOrigin)) trusted.add(requestOrigin);

    const host = request.headers.get("host");
    const protocol = requestOrigin.startsWith("https:") ? "https" : "http";
    const hostOrigin = host ? `${protocol}://${host}` : null;
    if (hostOrigin && isLoopbackOrigin(hostOrigin)) trusted.add(hostOrigin);
  }

  return trusted;
}

export function hasTrustedRequestOrigin(request: Request): boolean {
  const trustedOrigins = getTrustedOrigins(request);
  const origin = request.headers.get("origin");

  if (origin) {
    return trustedOrigins.has(origin);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return trustedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === "same-origin";
}

export function rejectUntrustedRequestOrigin(
  request: Request
): NextResponse | null {
  if (hasTrustedRequestOrigin(request)) {
    return null;
  }

  return NextResponse.json(
    { error: "Cross-origin browser requests are not allowed." },
    { status: 403 }
  );
}

export function rejectUntrustedSessionOrigin(
  request: Request,
  authMethod: "session" | "api_key" | null | undefined
): NextResponse | null {
  if (authMethod !== "session") {
    return null;
  }

  return rejectUntrustedRequestOrigin(request);
}

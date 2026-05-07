import { NextResponse } from "next/server";

function getExpectedOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host) {
    return `${forwardedProto ?? requestUrl.protocol.replace(/:$/, "")}://${host}`;
  }

  return requestUrl.origin;
}

export function hasTrustedRequestOrigin(request: Request): boolean {
  const expectedOrigin = getExpectedOrigin(request);
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
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

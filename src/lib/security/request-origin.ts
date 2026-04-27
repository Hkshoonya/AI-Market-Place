import { NextResponse } from "next/server";

export function hasTrustedRequestOrigin(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
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

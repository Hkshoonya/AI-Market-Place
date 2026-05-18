export function sanitizeAuthRedirect(rawRedirect?: string | null) {
  if (
    rawRedirect &&
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.includes(":")
  ) {
    return rawRedirect;
  }

  return "/";
}

export function buildAuthRouteHref(
  pathname: "/login" | "/signup",
  rawRedirect?: string | null
) {
  const redirectTo = sanitizeAuthRedirect(rawRedirect);

  if (redirectTo === "/") {
    return pathname;
  }

  return `${pathname}?redirect=${encodeURIComponent(redirectTo)}`;
}

export function buildAuthCallbackUrl(origin: string, rawRedirect?: string | null) {
  const redirectTo = sanitizeAuthRedirect(rawRedirect);

  return `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildCanonicalUrl,
  getCanonicalWwwHost,
} from "@/lib/constants/site";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/profile",
  "/sell",
  "/watchlists",
  "/activity",
];

// Route prefixes that require authentication
const PROTECTED_PREFIXES = [
  "/settings/",
  "/dashboard/",
  "/orders/",
  "/admin/",
];

function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTES.includes(pathname)) return true;
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin/") || pathname === "/admin";
}

export async function proxy(request: NextRequest) {
  // www -> apex redirect (must be first, before session handling)
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (host === getCanonicalWwwHost()) {
    return NextResponse.redirect(
      buildCanonicalUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`),
      301
    );
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - important for Server Components.
  // Wrap in try/catch so network failures (e.g. E2E test environments with a
  // dummy Supabase URL) don't crash the proxy and are treated as unauthenticated.
  let user = null;
  try {
    const {
      data: { user: resolvedUser },
    } = await supabase.auth.getUser();
    user = resolvedUser;
  } catch {
    // Network error or unreachable Supabase instance - treat as no session
  }

  const pathname = request.nextUrl.pathname;

  if (isProtectedRoute(pathname)) {
    if (!user) {
      return NextResponse.redirect(
        buildCanonicalUrl(`/login?redirect=${encodeURIComponent(pathname)}`)
      );
    }

    if (isAdminRoute(pathname)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        return NextResponse.redirect(buildCanonicalUrl("/"));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

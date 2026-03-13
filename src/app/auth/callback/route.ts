import { createClient } from "@/lib/supabase/server";
import { buildCanonicalUrl } from "@/lib/constants/site";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Validate redirect target to prevent open redirect attacks
  const sanitizedNext =
    next && next.startsWith("/") && !next.startsWith("//") && !next.includes(":")
      ? next
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(buildCanonicalUrl(sanitizedNext));
    }
  }

  // Auth code error — redirect to login with error
  return NextResponse.redirect(
    buildCanonicalUrl("/login?error=auth_callback_failed")
  );
}

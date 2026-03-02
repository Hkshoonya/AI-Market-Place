import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`contact:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const body = await request.json();
    const { name, email, category, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    // Persist to contact_submissions table
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { error: insertError } = await sb
      .from("contact_submissions")
      .insert({
        name,
        email,
        category: category || "general",
        subject,
        message,
        metadata: { ip, user_agent: request.headers.get("user-agent") || "" },
      });

    if (insertError) {
      console.error("[Contact Form] DB insert failed:", insertError.message);
      // Still return success to user — log the error server-side
      // and fall back to console logging
      console.info("[Contact Form Submission - Fallback]", {
        name, email, category: category || "general", subject, message,
        timestamp: new Date().toISOString(), ip,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your message! We've received it and will respond soon.",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process contact form." },
      { status: 500 }
    );
  }
}

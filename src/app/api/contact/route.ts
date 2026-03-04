import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").max(320),
  category: z.string().max(100).optional(),
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(1, "Message is required").max(10000),
});

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
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { name, email, category, subject, message } = parsed.data;

    // Persist to contact_submissions table
    const supabase = createAdminClient();

    const { error: insertError } = await supabase
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
      void systemLog.error("api/contact", "DB insert failed", { error: insertError.message });
      // Still return success to user — log the error server-side
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your message! We've received it and will respond soon.",
    });
  } catch (err) {
    return handleApiError(err, "api/contact");
  }
}

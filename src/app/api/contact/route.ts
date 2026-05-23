import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";
import { sendContactSubmissionEmail } from "@/lib/email/contact-email";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").max(320),
  category: z.string().max(100).optional(),
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(1, "Message is required").max(10000),
  listing_id: z.string().uuid().optional().or(z.string().min(1).max(200).optional()),
  seller_id: z.string().uuid().optional().or(z.string().min(1).max(200).optional()),
});

export const dynamic = "force-dynamic";

async function notifyAdminsAboutContactSubmission(
  supabase: ReturnType<typeof createAdminClient>,
  subject: string,
  name: string,
  email: string
) {
  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  if (adminsError) {
    void systemLog.warn("api/contact", "Admin notification recipient lookup failed", {
      error: adminsError.message,
    });
    return;
  }

  const adminIds = (admins ?? [])
    .map((admin) => admin.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (adminIds.length === 0) {
    return;
  }

  const { error: notifError } = await supabase.from("notifications").insert(
    adminIds.map((userId) => ({
      user_id: userId,
      type: "system" as const,
      title: "New contact submission",
      message: `${name} (${email}) · ${subject}`,
      link: "/admin",
    }))
  );

  if (notifError) {
    void systemLog.warn("api/contact", "Admin contact notification insert failed", {
      error: notifError.message,
      adminCount: adminIds.length,
    });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`contact:${ip}`, RATE_LIMITS.write);
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
    const { name, email, category, subject, message, listing_id, seller_id } = parsed.data;

    // Persist to contact_submissions table
    const supabase = createAdminClient();
    let listingContext:
      | {
          id: string;
          seller_id: string;
          title: string | null;
          slug: string | null;
          inquiry_count: number;
        }
      | null = null;

    if (listing_id) {
      const { data: listing } = await supabase
        .from("marketplace_listings")
        .select("id, seller_id, title, slug, inquiry_count")
        .eq("id", listing_id)
        .single();

      if (listing?.seller_id) {
        listingContext = {
          id: listing.id,
          seller_id: listing.seller_id,
          title: typeof listing.title === "string" ? listing.title : null,
          slug: typeof listing.slug === "string" ? listing.slug : null,
          inquiry_count:
            typeof listing.inquiry_count === "number" ? listing.inquiry_count : 0,
        };
      }
    }

    const { error: insertError } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email,
        category: category || "general",
        subject,
        message,
        metadata: {
          ip,
          user_agent: request.headers.get("user-agent") || "",
          seller_id: listingContext?.seller_id ?? seller_id ?? null,
          listing_id: listingContext?.id ?? listing_id ?? null,
          listing_title: listingContext?.title ?? null,
          listing_slug: listingContext?.slug ?? null,
        },
      });

    if (insertError) {
      void systemLog.error("api/contact", "DB insert failed", { error: insertError.message });
      return NextResponse.json(
        { error: "Failed to save your message. Please try again." },
        { status: 500 }
      );
    }

    if (listingContext?.seller_id) {
      const { error: inquiryCountError } = await supabase
        .from("marketplace_listings")
        .update({ inquiry_count: listingContext.inquiry_count + 1 })
        .eq("id", listingContext.id);

      if (inquiryCountError) {
        void systemLog.warn("api/contact", "Listing inquiry count update failed", {
          error: inquiryCountError.message,
          listingId: listingContext.id,
        });
      }

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: listingContext.seller_id,
        type: "marketplace",
        title: "New marketplace inquiry",
        message: subject,
        link: listingContext.slug ? `/marketplace/${listingContext.slug}` : "/marketplace",
      });

      if (notifError) {
        void systemLog.warn("api/contact", "Seller notification insert failed", {
          error: notifError.message,
          listingId: listingContext.id,
          sellerId: listingContext.seller_id,
        });
      }
    } else {
      await notifyAdminsAboutContactSubmission(supabase, subject, name, email);
      const emailResult = await sendContactSubmissionEmail({
        name,
        email,
        category: category || "general",
        subject,
        message,
      });

      if (emailResult.status === "failed") {
        void systemLog.warn("api/contact", "Contact email delivery failed", {
          error: emailResult.error,
          category: category || "general",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your message! We've received it and will respond soon.",
    });
  } catch (err) {
    return handleApiError(err, "api/contact");
  }
}

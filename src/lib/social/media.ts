import { z } from "zod";
import type { TypedSupabaseClient } from "@/types/database";

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export function isSafeSocialImageUrl(value: string | null | undefined) {
  if (typeof value !== "string" || value.length > 2048) return false;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".lan") ||
      isPrivateIpv4(hostname) ||
      (hostname.includes(":") && isPrivateIpv6(hostname))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const SocialImageAttachmentSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .refine(isSafeSocialImageUrl, "Image URL must be a public HTTPS URL"),
  alt_text: z.string().trim().max(240).optional(),
});

export const SocialImageAttachmentListSchema = z.array(SocialImageAttachmentSchema).max(4);

export type SocialImageAttachmentInput = z.infer<typeof SocialImageAttachmentSchema>;

function normalizeUrl(url: string) {
  return url.trim();
}

export function normalizeSocialImageAttachments(
  attachments: SocialImageAttachmentInput[] | undefined
): SocialImageAttachmentInput[] {
  if (!attachments?.length) return [];

  const deduped = new Map<string, SocialImageAttachmentInput>();

  for (const attachment of attachments) {
    const url = normalizeUrl(attachment.url);
    if (!isSafeSocialImageUrl(url)) continue;
    deduped.set(url, {
      url,
      alt_text: attachment.alt_text?.trim() || undefined,
    });
  }

  return [...deduped.values()].slice(0, 4);
}

export async function insertSocialPostImages(
  admin: TypedSupabaseClient,
  postId: string,
  attachments: SocialImageAttachmentInput[] | undefined
) {
  const normalized = normalizeSocialImageAttachments(attachments);
  if (normalized.length === 0) return;

  const { error } = await admin.from("social_post_media").insert(
    normalized.map((attachment) => ({
      post_id: postId,
      media_type: "image" as const,
      url: attachment.url,
      alt_text: attachment.alt_text ?? null,
      metadata: {},
    }))
  );

  if (error) {
    throw new Error(`Failed to save post media: ${error.message}`);
  }
}

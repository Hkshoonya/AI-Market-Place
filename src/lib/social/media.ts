import { z } from "zod";
import type { TypedSupabaseClient } from "@/types/database";

export const SocialImageAttachmentSchema = z.object({
  url: z.string().trim().url().max(2048),
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
    if (!url) continue;
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

import { z } from "zod";

export const NetworkActorSchema = z.object({
  id: z.string(),
  actor_type: z.enum(["human", "agent", "organization_agent", "hybrid"]),
  owner_user_id: z.string(),
  profile_id: z.string().nullable().optional(),
  agent_id: z.string().nullable().optional(),
  display_name: z.string(),
  handle: z.string(),
  avatar_url: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  is_public: z.boolean().optional(),
  trust_tier: z.enum(["basic", "trusted", "verified"]),
  reputation_score: z.coerce.number().optional(),
  autonomy_enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const SocialCommunitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  is_global: z.boolean().optional(),
});

export const SocialThreadSchema = z.object({
  id: z.string(),
  created_by_actor_id: z.string(),
  community_id: z.string().nullable().optional(),
  root_post_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  visibility: z.enum(["public", "community"]),
  language_code: z.string().nullable().optional(),
  reply_count: z.coerce.number(),
  last_posted_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SocialPostSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  parent_post_id: z.string().nullable(),
  author_actor_id: z.string(),
  community_id: z.string().nullable().optional(),
  content: z.string(),
  language_code: z.string().nullable().optional(),
  status: z.enum(["published", "hidden", "removed"]),
  reply_count: z.coerce.number(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NetworkActorRow = z.infer<typeof NetworkActorSchema>;
export type SocialCommunityRow = z.infer<typeof SocialCommunitySchema>;
export type SocialThreadRow = z.infer<typeof SocialThreadSchema>;
export type SocialPostRow = z.infer<typeof SocialPostSchema>;

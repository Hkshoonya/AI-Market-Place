// Derived from database.ts interfaces (Profile, ModelComment, Watchlist, WatchlistItem, UserBookmark)
import { z } from "zod";

// ── Base Schema: Profile ────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  reputation_score: z.number(),
  is_admin: z.boolean(),
  is_banned: z.boolean(),
  is_seller: z.boolean(),
  seller_bio: z.string().nullable(),
  seller_website: z.string().nullable(),
  seller_verified: z.boolean(),
  total_sales: z.number(),
  seller_rating: z.number().nullable(),
  joined_at: z.string().nullable(),
  email: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProfileType = z.infer<typeof ProfileSchema>;

// ── Base Schema: ModelComment (Comment) ─────────────────────────────────

export const CommentSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  user_id: z.string(),
  parent_id: z.string().nullable(),
  content: z.string(),
  upvotes: z.number(),
  is_edited: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CommentType = z.infer<typeof CommentSchema>;

// ── Base Schema: Watchlist ──────────────────────────────────────────────

export const WatchlistSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_public: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type WatchlistType = z.infer<typeof WatchlistSchema>;

// ── Base Schema: WatchlistItem ──────────────────────────────────────────

export const WatchlistItemSchema = z.object({
  id: z.string(),
  watchlist_id: z.string(),
  model_id: z.string(),
  added_at: z.string(),
});

export type WatchlistItemType = z.infer<typeof WatchlistItemSchema>;

// ── Base Schema: UserBookmark ───────────────────────────────────────────

export const BookmarkSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  model_id: z.string(),
  created_at: z.string(),
});

export type BookmarkType = z.infer<typeof BookmarkSchema>;

// ── Query-Specific Schemas ──────────────────────────────────────────────

// Watchlist with items (for API routes)
export const WatchlistWithItemsSchema = WatchlistSchema.extend({
  watchlist_items: z.array(WatchlistItemSchema.extend({
    models: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      provider: z.string(),
      category: z.string(),
      overall_rank: z.number().nullable(),
      quality_score: z.number().nullable(),
      market_cap_estimate: z.number().nullable(),
    }).optional(),
  })).optional(),
});

export type WatchlistWithItems = z.infer<typeof WatchlistWithItemsSchema>;

// ── Client Component Query Schemas ────────────────────────────────────

// Comment with joined profile (comments-section.tsx)
// Note: replies are computed in JS after a second query, not part of Supabase response
export const CommentWithProfileSchema = CommentSchema.extend({
  profiles: z.object({
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    username: z.string().nullable(),
  }).nullable().optional(),
});

export type CommentWithProfile = z.infer<typeof CommentWithProfileSchema>;

// Bookmark with joined model (profile-content.tsx)
export const BookmarkWithModelSchema = BookmarkSchema.pick({
  id: true,
  model_id: true,
}).extend({
  models: z.object({
    slug: z.string().optional(),
    name: z.string().optional(),
    provider: z.string().optional(),
  }).nullable().optional(),
});

export type BookmarkWithModel = z.infer<typeof BookmarkWithModelSchema>;

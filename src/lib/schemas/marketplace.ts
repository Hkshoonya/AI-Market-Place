// Derived from database.ts interfaces (MarketplaceListing, MarketplaceReview, MarketplaceOrder, OrderMessage)
import { z } from "zod";

// ── Base Schema: MarketplaceListing ─────────────────────────────────────

export const MarketplaceListingSchema = z.object({
  id: z.string(),
  seller_id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  short_description: z.string().nullable(),
  listing_type: z.string(),
  status: z.string(),
  pricing_type: z.string(),
  price: z.coerce.number().nullable(),
  currency: z.string(),
  model_id: z.string().nullable(),
  tags: z.array(z.string()),
  thumbnail_url: z.string().nullable(),
  demo_url: z.string().nullable(),
  documentation_url: z.string().nullable(),
  view_count: z.coerce.number(),
  inquiry_count: z.coerce.number(),
  purchase_count: z.coerce.number(),
  avg_rating: z.coerce.number().nullable(),
  review_count: z.coerce.number(),
  is_featured: z.boolean(),
  content_risk_level: z.string().optional(),
  autonomy_risk_level: z.string().optional(),
  purchase_mode: z.string().optional(),
  autonomy_mode: z.string().optional(),
  agent_config: z.record(z.string(), z.unknown()).nullable().optional(),
  mcp_manifest: z.record(z.string(), z.unknown()).nullable().optional(),
  preview_manifest: z.record(z.string(), z.unknown()).nullable().optional(),
  agent_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MarketplaceListingType = z.infer<typeof MarketplaceListingSchema>;

// ── Base Schema: MarketplaceReview ──────────────────────────────────────

export const MarketplaceReviewSchema = z.object({
  id: z.string(),
  listing_id: z.string(),
  reviewer_id: z.string(),
  rating: z.coerce.number(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  is_verified_purchase: z.boolean(),
  upvotes: z.coerce.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MarketplaceReviewType = z.infer<typeof MarketplaceReviewSchema>;

// ── Base Schema: MarketplaceOrder ───────────────────────────────────────

export const MarketplaceOrderSchema = z.object({
  id: z.string(),
  listing_id: z.string(),
  buyer_id: z.string().nullable(),
  seller_id: z.string(),
  status: z.string(),
  message: z.string().nullable(),
  price_at_time: z.coerce.number().nullable(),
  delivery_data: z.record(z.string(), z.unknown()).nullable(),
  fulfillment_manifest_snapshot: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MarketplaceOrderType = z.infer<typeof MarketplaceOrderSchema>;

// ── Base Schema: OrderMessage ───────────────────────────────────────────

export const OrderMessageSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  sender_id: z.string(),
  content: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
});

export type OrderMessageType = z.infer<typeof OrderMessageSchema>;

// ── Query-Specific Schemas ──────────────────────────────────────────────

// Listing with seller profile (marketplace browse, detail pages)
export const MarketplaceListingWithSellerSchema = MarketplaceListingSchema.extend({
  profiles: z.object({
    id: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    username: z.string().nullable(),
    is_seller: z.boolean(),
    seller_verified: z.boolean(),
    seller_rating: z.coerce.number().nullable(),
    total_sales: z.coerce.number(),
  }).optional(),
  models: z.object({
    name: z.string(),
    slug: z.string(),
    provider: z.string(),
    quality_score: z.coerce.number().nullable(),
  }).nullable().optional(),
});

export type MarketplaceListingWithSeller = z.infer<typeof MarketplaceListingWithSellerSchema>;

// Review with reviewer profile
export const MarketplaceReviewWithProfileSchema = MarketplaceReviewSchema.extend({
  profiles: z.object({
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    username: z.string().nullable(),
  }).optional(),
});

export type MarketplaceReviewWithProfile = z.infer<typeof MarketplaceReviewWithProfileSchema>;

// Order with listing and buyer profile
export const MarketplaceOrderWithDetailsSchema = MarketplaceOrderSchema.extend({
  marketplace_listings: z.object({
    title: z.string(),
    slug: z.string(),
    listing_type: z.string(),
  }).optional(),
  profiles: z.object({
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }).optional(),
});

export type MarketplaceOrderWithDetails = z.infer<typeof MarketplaceOrderWithDetailsSchema>;

// Order message with sender profile
export const OrderMessageWithProfileSchema = OrderMessageSchema.extend({
  profiles: z.object({
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    username: z.string().nullable(),
  }).optional(),
});

export type OrderMessageWithProfile = z.infer<typeof OrderMessageWithProfileSchema>;

// ── Client Component Query Schemas ────────────────────────────────────

// Seller order row with listing and buyer profile (seller-orders-table.tsx)
export const SellerOrderRowSchema = MarketplaceOrderSchema.extend({
  marketplace_listings: z.object({
    title: z.string().nullable(),
    slug: z.string().nullable(),
    listing_type: z.string().nullable(),
  }).nullable().optional(),
  profiles: z.object({
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }).nullable().optional(),
});

export type SellerOrderRow = z.infer<typeof SellerOrderRowSchema>;

// Profile pick for enrichment queries (id + display fields)
export const ProfilePickSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  username: z.string().nullable(),
});

export type ProfilePick = z.infer<typeof ProfilePickSchema>;

// Order profile pick (without username)
export const OrderProfilePickSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

export type OrderProfilePick = z.infer<typeof OrderProfilePickSchema>;

// Order with listing join only — no FK alias joins to profiles (orders-content.tsx, order-detail-content.tsx)
export const OrderWithListingSchema = MarketplaceOrderSchema.extend({
  marketplace_listings: z.object({
    title: z.string().nullable(),
    slug: z.string().nullable(),
    listing_type: z.string().nullable(),
    thumbnail_url: z.string().nullable().optional(),
  }).nullable().optional(),
});

export type OrderWithListing = z.infer<typeof OrderWithListingSchema>;

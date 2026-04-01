// Database types for Supabase
// These will be auto-generated later with `supabase gen types typescript`
// For now, manual types matching our schema

import type { SupabaseClient } from "@supabase/supabase-js";

// Helper type: converts an interface to a mapped object type compatible with
// Record<string, unknown>, which is required by the Supabase SDK's GenericTable constraint.
// Without this, interface types cause Supabase query builder to infer `never` for Row/Insert types.
type AsRow<T> = { [K in keyof T]: T[K] };

export type ModelCategory =
  | "llm"
  | "image_generation"
  | "vision"
  | "multimodal"
  | "embeddings"
  | "speech_audio"
  | "video"
  | "code"
  | "agentic_browser"
  | "specialized";

export type ModelStatus = "active" | "deprecated" | "beta" | "preview" | "archived";
export type LicenseType = "open_source" | "commercial" | "research_only" | "custom";

export interface Model {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: ModelCategory;
  status: ModelStatus;
  description: string | null;
  short_description: string | null;
  architecture: string | null;
  parameter_count: number | null;
  context_window: number | null;
  training_data_cutoff: string | null;
  release_date: string | null;
  hf_model_id: string | null;
  hf_downloads: number;
  hf_likes: number;
  hf_trending_score: number | null;
  arxiv_paper_id: string | null;
  website_url: string | null;
  github_url: string | null;
  license: LicenseType;
  license_name: string | null;
  is_open_weights: boolean;
  is_api_available: boolean;
  supported_languages: string[];
  modalities: string[];
  capabilities: Record<string, boolean>;
  provider_id: number | null;
  overall_rank: number | null;
  popularity_score: number | null;
  adoption_score: number | null;
  quality_score: number | null;
  value_score: number | null;
  economic_footprint_score: number | null;
  market_cap_estimate: number | null;
  popularity_rank: number | null;
  adoption_rank: number | null;
  github_stars: number | null;
  github_forks: number | null;
  agent_score: number | null;
  agent_rank: number | null;
  capability_score: number | null;
  capability_rank: number | null;
  economic_footprint_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
  created_at: string;
  updated_at: string;
  data_refreshed_at: string | null;
}

export interface BenchmarkScore {
  id: string;
  model_id: string;
  benchmark_id: number;
  score: number;
  score_normalized: number | null;
  evaluation_date: string | null;
  model_version: string | null;
  source: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  benchmark?: Benchmark;
}

export interface Benchmark {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  score_type: string;
  min_score: number | null;
  max_score: number | null;
  higher_is_better: boolean;
  source: string | null;
  source_url: string | null;
  is_active: boolean;
}

export interface ModelPricing {
  id: string;
  model_id: string;
  provider_name: string;
  pricing_model: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  cached_input_price_per_million: number | null;
  price_per_call: number | null;
  price_per_gpu_second: number | null;
  subscription_monthly: number | null;
  credits_per_dollar: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token: number | null;
  uptime_percentage: number | null;
  blended_price_per_million: number | null;
  currency: string;
  is_free_tier: boolean;
  free_tier_limits: Record<string, unknown> | null;
  effective_date: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface EloRating {
  id: string;
  model_id: string;
  arena_name: string;
  elo_score: number;
  confidence_interval_low: number | null;
  confidence_interval_high: number | null;
  num_battles: number | null;
  rank: number | null;
  snapshot_date: string;
  created_at: string;
}

export interface Ranking {
  id: string;
  model_id: string;
  ranking_type: string;
  rank: number;
  score: number | null;
  previous_rank: number | null;
  computed_at: string;
}

export interface ModelUpdate {
  id: string;
  model_id: string;
  update_type: string;
  title: string;
  description: string | null;
  old_value: unknown;
  new_value: unknown;
  source_url: string | null;
  published_at: string;
  created_at: string;
  // Joined
  model?: Model;
}

export interface Provider {
  id: number;
  slug: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  website_url: string | null;
  brand_color: string | null;
  description: string | null;
  founded_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface ModelSnapshot {
  id: string;
  model_id: string;
  snapshot_date: string;
  hf_downloads: number | null;
  hf_likes: number | null;
  quality_score: number | null;
  overall_rank: number | null;
  market_cap_estimate: number | null;
  popularity_score: number | null;
  adoption_score: number | null;
  economic_footprint_score: number | null;
  agent_score: number | null;
  capability_score: number | null;
  usage_score: number | null;
  expert_score: number | null;
  signal_coverage: Record<string, boolean> | null;
  source_coverage: Record<string, unknown> | null;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  tag_group: string | null;
}

// Data Aggregation types
export type DataSourceSyncStatus = "success" | "partial" | "failed";

export interface DataSource {
  id: number;
  slug: string;
  name: string;
  adapter_type: string;
  description: string | null;
  is_enabled: boolean;
  tier: number;
  sync_interval_hours: number;
  priority: number;
  config: Record<string, unknown>;
  secret_env_keys: string[];
  output_types: string[];
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_sync_at: string | null;
  last_sync_status: DataSourceSyncStatus | null;
  last_sync_records: number;
  last_error_message: string | null;
  quarantined_at: string | null;
  quarantine_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelNews {
  id: string;
  source: string;
  source_id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string;
  category: string;
  related_model_ids: string[] | null;
  related_provider: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SyncJob {
  id: string;
  source: string;
  job_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Auth & Community types
export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  reputation_score: number;
  is_admin: boolean;
  is_banned: boolean;
  is_seller: boolean;
  seller_bio: string | null;
  seller_website: string | null;
  seller_verified: boolean;
  total_sales: number;
  seller_rating: number | null;
  joined_at: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBookmark {
  id: string;
  user_id: string;
  model_id: string;
  created_at: string;
}

export interface ModelComment {
  id: string;
  model_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  upvotes: number;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRating {
  id: string;
  user_id: string;
  model_id: string;
  score: number;
  review: string | null;
  created_at: string;
  updated_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  model_id: string;
  added_at: string;
}

export type NetworkActorType = "human" | "agent" | "organization_agent" | "hybrid";
export type NetworkActorTrustTier = "basic" | "trusted" | "verified";
export type MarketplacePolicyDecision = "allow" | "review" | "block";
export type ListingPolicyReviewStatus = "open" | "approved" | "rejected" | "dismissed";
export type MarketplaceContentRiskLevel = "allow" | "review" | "block";
export type MarketplaceAutonomyRiskLevel = "allow" | "manual_only" | "restricted" | "block";
export type MarketplacePurchaseMode =
  | "public_purchase_allowed"
  | "manual_review_required"
  | "purchase_blocked";
export type MarketplaceAutonomyMode =
  | "autonomous_allowed"
  | "manual_only"
  | "restricted"
  | "autonomous_blocked";
export type SocialVisibility = "public" | "community";
export type SocialPostStatus = "published" | "hidden" | "removed";
export type SocialThreadBlockReason = "thread_owner_block" | "spam" | "abuse";
export type SocialPostReportReason =
  | "spam"
  | "abuse"
  | "illegal_goods"
  | "malware"
  | "fraud"
  | "other";
export type SocialPostReportStatus = "open" | "triaged" | "actioned" | "dismissed";
export type SocialPostReportAutomationState =
  | "pending"
  | "auto_actioned"
  | "needs_admin_review"
  | "admin_resolved";

export interface NetworkActor {
  id: string;
  actor_type: NetworkActorType;
  owner_user_id: string;
  profile_id: string | null;
  agent_id: string | null;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  trust_tier: NetworkActorTrustTier;
  reputation_score: number;
  autonomy_enabled: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SocialCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_by_actor_id: string | null;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialThread {
  id: string;
  created_by_actor_id: string;
  community_id: string | null;
  root_post_id: string | null;
  title: string | null;
  visibility: SocialVisibility;
  language_code: string | null;
  reply_count: number;
  last_posted_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  thread_id: string;
  parent_post_id: string | null;
  author_actor_id: string;
  community_id: string | null;
  content: string;
  language_code: string | null;
  status: SocialPostStatus;
  reply_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPostMedia {
  id: string;
  post_id: string;
  media_type: "image" | "link_preview";
  url: string;
  alt_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SocialThreadBlock {
  id: string;
  thread_id: string;
  blocked_actor_id: string;
  blocked_by_actor_id: string;
  reason: SocialThreadBlockReason;
  created_at: string;
}

export interface SocialPostReport {
  id: string;
  post_id: string;
  thread_id: string;
  reporter_actor_id: string;
  target_actor_id: string | null;
  reason: SocialPostReportReason;
  details: string | null;
  status: SocialPostReportStatus;
  automation_state: SocialPostReportAutomationState;
  classifier_label: string | null;
  classifier_confidence: number | null;
  resolved_by_actor_id: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Marketplace types
export type ListingType = "api_access" | "model_weights" | "fine_tuned_model" | "dataset" | "prompt_template" | "agent" | "mcp_server";
export type ListingStatus = "draft" | "active" | "paused" | "sold_out" | "archived";
export type MarketplacePricingType = "one_time" | "monthly_subscription" | "per_token" | "per_request" | "free" | "contact";
export type OrderStatus = "pending" | "approved" | "rejected" | "completed" | "cancelled";

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  slug: string;
  title: string;
  description: string;
  short_description: string | null;
  listing_type: ListingType;
  status: ListingStatus;
  pricing_type: MarketplacePricingType;
  price: number | null;
  currency: string;
  model_id: string | null;
  tags: string[];
  thumbnail_url: string | null;
  demo_url: string | null;
  documentation_url: string | null;
  view_count: number;
  inquiry_count: number;
  purchase_count: number;
  avg_rating: number | null;
  review_count: number;
  is_featured: boolean;
  content_risk_level?: MarketplaceContentRiskLevel;
  autonomy_risk_level?: MarketplaceAutonomyRiskLevel;
  purchase_mode?: MarketplacePurchaseMode;
  autonomy_mode?: MarketplaceAutonomyMode;
  agent_config?: Record<string, unknown> | null;
  mcp_manifest?: Record<string, unknown> | null;
  preview_manifest?: Record<string, unknown> | null;
  agent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceReview {
  id: string;
  listing_id: string;
  reviewer_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  is_verified_purchase: boolean;
  upvotes: number;
  created_at: string;
  updated_at: string;
  // Joined
  profiles?: Pick<Profile, "display_name" | "avatar_url" | "username">;
}

export interface MarketplaceOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  message: string | null;
  price_at_time: number | null;
  delivery_data: Record<string, unknown> | null;
  fulfillment_manifest_snapshot?: Record<string, unknown> | null;
  guest_email?: string | null;
  guest_name?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  marketplace_listings?: Pick<MarketplaceListing, "title" | "slug" | "listing_type">;
  profiles?: Pick<Profile, "display_name" | "avatar_url">;
}

export interface MarketplaceListingWithSeller extends MarketplaceListing {
  profiles?: Pick<Profile, "id" | "display_name" | "avatar_url" | "username" | "is_seller" | "seller_verified" | "seller_rating" | "total_sales">;
  models?: Pick<Model, "name" | "slug" | "provider" | "quality_score"> | null;
}

export interface ListingPolicyReview {
  id: string;
  listing_id: string;
  seller_id: string;
  source_action: "create" | "update" | "manual_rescan";
  decision: MarketplacePolicyDecision;
  classifier_label: string;
  classifier_confidence: number;
  content_risk_level: MarketplaceContentRiskLevel;
  autonomy_risk_level: MarketplaceAutonomyRiskLevel;
  purchase_mode: MarketplacePurchaseMode;
  autonomy_mode: MarketplaceAutonomyMode;
  reason_codes: string[];
  reasons: string[];
  matched_signals: unknown;
  excerpt: string | null;
  review_status: ListingPolicyReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutonomousCommercePolicy {
  owner_id: string;
  is_enabled: boolean;
  max_order_amount: number;
  daily_spend_limit: number;
  allowed_listing_types: string[];
  require_verified_sellers: boolean;
  block_flagged_listings: boolean;
  require_manifest_snapshot: boolean;
  allow_manual_only_listings: boolean;
  max_autonomy_risk_level: MarketplaceAutonomyRiskLevel;
  created_at: string;
  updated_at: string;
}

// Order messages
export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  // Joined
  profiles?: Pick<Profile, "display_name" | "avatar_url" | "username">;
}

// Seller verification requests
export type VerificationStatus = "pending" | "approved" | "rejected";

export interface SellerVerificationRequest {
  id: string;
  user_id: string;
  status: VerificationStatus;
  business_name: string;
  business_description: string | null;
  website_url: string | null;
  portfolio_url: string | null;
  reason: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Notification types
export type NotificationType = "model_update" | "watchlist_change" | "order_update" | "system" | "marketplace";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_model_updates: boolean;
  email_watchlist_changes: boolean;
  email_order_updates: boolean;
  email_marketplace: boolean;
  email_newsletter: boolean;
  in_app_model_updates: boolean;
  in_app_watchlist_changes: boolean;
  in_app_order_updates: boolean;
  in_app_marketplace: boolean;
  updated_at: string;
}

// Agent Infrastructure types
export type AgentType = "resident" | "marketplace" | "visitor";
export type AgentStatus = "active" | "paused" | "disabled" | "error";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AgentIssueSeverity = "critical" | "high" | "medium" | "low";
export type AgentIssueStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "escalated"
  | "ignored";
export type AgentDeferredStatus = "open" | "planned" | "done" | "dropped";
export type AgentDeferredRiskLevel = "high" | "medium" | "low";
export type AgentProviderSettingProvider =
  | "openrouter"
  | "deepseek"
  | "minimax"
  | "anthropic";

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  agent_type: AgentType;
  owner_id: string | null;
  status: AgentStatus;
  capabilities: string[];
  config: Record<string, unknown>;
  mcp_endpoint: string | null;
  api_key_hash: string | null;
  last_active_at: string | null;
  total_tasks_completed: number;
  total_conversations: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  status: TaskStatus;
  priority: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentLog {
  id: number;
  agent_id: string;
  task_id: string | null;
  level: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentIssue {
  id: string;
  slug: string;
  title: string;
  issue_type: string;
  source: string | null;
  severity: AgentIssueSeverity;
  status: AgentIssueStatus;
  confidence: number;
  detected_by: string;
  playbook: string | null;
  evidence: Record<string, unknown>;
  verification: Record<string, unknown> | null;
  retry_count: number;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDeferredItem {
  id: string;
  slug: string;
  title: string;
  area: string;
  reason: string;
  risk_level: AgentDeferredRiskLevel;
  required_before: string | null;
  owner_hint: string | null;
  notes: Record<string, unknown> | null;
  status: AgentDeferredStatus;
  created_at: string;
  updated_at: string;
}

export interface AgentProviderSetting {
  provider: AgentProviderSettingProvider;
  model_id: string;
  updated_at: string;
  updated_by: string | null;
}

export interface ApiKeyRecord {
  id: string;
  owner_id: string;
  agent_id: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AgentConversation {
  id: string;
  participant_a: string;
  participant_b: string;
  participant_a_type: "agent" | "user";
  participant_b_type: "agent" | "user";
  topic: string | null;
  status: "active" | "closed" | "archived";
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: "agent" | "user";
  content: string;
  message_type: "text" | "tool_call" | "tool_result" | "system";
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkspaceSessionRecord {
  user_id: string;
  workspace_state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRuntimeRecord {
  id: string;
  user_id: string;
  model_slug: string;
  model_name: string;
  provider_name: string | null;
  workspace_conversation_id: string | null;
  status: "draft" | "ready" | "paused";
  endpoint_slug: string;
  total_requests: number;
  total_tokens: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDeploymentRecord {
  id: string;
  user_id: string;
  runtime_id: string | null;
  model_slug: string;
  model_name: string;
  provider_name: string | null;
  status: "provisioning" | "ready" | "paused" | "failed";
  endpoint_slug: string;
  deployment_kind: "managed_api" | "assistant_only";
  deployment_label: string | null;
  credits_budget: number | null;
  monthly_price_estimate: number | null;
  total_requests: number;
  total_tokens: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// Wallet & Payment types
export type WalletOwnerType = 'user' | 'agent';
export type WalletTxType = 'deposit' | 'withdrawal' | 'purchase' | 'sale' | 'escrow_hold' | 'escrow_release' | 'bid_hold' | 'bid_release' | 'refund' | 'platform_fee' | 'api_charge';
export type WalletTxStatus = 'pending' | 'confirmed' | 'failed';
export type ChainType = 'solana' | 'base' | 'polygon' | 'internal';
export type TokenType = 'USDC' | 'SOL' | 'ETH' | 'MATIC';
export type EscrowStatus = 'held' | 'released' | 'refunded';
export type EscrowReason = 'purchase' | 'bid' | 'auction';

export interface Wallet {
  id: string;
  owner_id: string;
  owner_type: WalletOwnerType;
  balance: number;
  held_balance: number;
  total_earned: number;
  total_spent: number;
  primary_chain: ChainType;
  deposit_address_solana: string | null;
  deposit_address_evm: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTxType;
  amount: number;
  fee: number;
  net_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  chain: ChainType;
  tx_hash: string | null;
  token: TokenType;
  status: WalletTxStatus;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EscrowHold {
  id: string;
  wallet_id: string;
  amount: number;
  reason: EscrowReason;
  reference_type: string;
  reference_id: string;
  status: EscrowStatus;
  held_at: string;
  released_at: string | null;
  released_to_wallet_id: string | null;
  platform_fee_amount: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlatformFeeTier {
  id: number;
  min_lifetime_sales: number;
  max_lifetime_sales: number | null;
  fee_percentage: number;
  created_at: string;
}

export interface ApiEndpointPricing {
  id: number;
  path_pattern: string;
  method: string;
  price_per_call: number;
  is_free_for_humans: boolean;
  rate_limit_free: number;
  rate_limit_paid: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// Phase 6: Deployment & Description types
export type DeploymentPlatformType = 'api' | 'hosting' | 'subscription' | 'self-hosted' | 'local';
export type DeploymentStatus = 'available' | 'coming_soon' | 'deprecated';
export type DeploymentPricingModel = 'per-token' | 'per-second' | 'monthly' | 'free';
export type DescriptionGeneratedBy = 'ai' | 'community' | 'curated';

export interface DeploymentPlatform {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  type: DeploymentPlatformType;
  affiliate_url_template: string | null;
  has_affiliate: boolean;
  affiliate_commission: string | null;
  base_url: string;
  created_at: string;
  updated_at: string;
}

export interface ModelDeployment {
  id: string;
  model_id: string;
  platform_id: string;
  deploy_url: string | null;
  pricing_model: DeploymentPricingModel | null;
  price_per_unit: number | null;
  unit_description: string | null;
  free_tier: string | null;
  one_click: boolean;
  status: DeploymentStatus;
  last_price_check: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  platform?: DeploymentPlatform;
}

export interface ModelDescription {
  id: string;
  model_id: string;
  summary: string | null;
  pros: Array<{ title: string; description: string; source: string }>;
  cons: Array<{ title: string; description: string; source: string }>;
  best_for: string[];
  not_ideal_for: string[];
  comparison_notes: string | null;
  generated_by: DescriptionGeneratedBy;
  last_generated: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}

export type TypedSupabaseClient = SupabaseClient<Database>;

// Model with all relations joined
export interface ModelWithDetails extends Model {
  benchmark_scores?: BenchmarkScore[];
  model_pricing?: ModelPricing[];
  elo_ratings?: EloRating[];
  rankings?: Ranking[];
  model_updates?: ModelUpdate[];
  tags?: Tag[];
}

// Supabase Database type (for typed client)
export interface Database {
  public: {
    Tables: {
      models: {
        Row: AsRow<Model>;
        Insert: Partial<Model> & Pick<Model, "slug" | "name" | "provider" | "category">;
        Update: Partial<Model>;
        Relationships: [];
      };
      benchmarks: {
        Row: AsRow<Benchmark>;
        Insert: Partial<Benchmark> & Pick<Benchmark, "slug" | "name">;
        Update: Partial<Benchmark>;
        Relationships: [];
      };
      benchmark_scores: {
        Row: AsRow<BenchmarkScore>;
        Insert: Partial<BenchmarkScore> &
          Pick<BenchmarkScore, "model_id" | "benchmark_id" | "score">;
        Update: Partial<BenchmarkScore>;
        Relationships: [];
      };
      model_pricing: {
        Row: AsRow<ModelPricing>;
        Insert: Partial<ModelPricing> &
          Pick<ModelPricing, "model_id" | "provider_name" | "pricing_model">;
        Update: Partial<ModelPricing>;
        Relationships: [];
      };
      elo_ratings: {
        Row: AsRow<EloRating>;
        Insert: Partial<EloRating> &
          Pick<EloRating, "model_id" | "elo_score" | "snapshot_date">;
        Update: Partial<EloRating>;
        Relationships: [];
      };
      rankings: {
        Row: AsRow<Ranking>;
        Insert: Partial<Ranking> & Pick<Ranking, "model_id" | "ranking_type" | "rank">;
        Update: Partial<Ranking>;
        Relationships: [];
      };
      model_updates: {
        Row: AsRow<ModelUpdate>;
        Insert: Partial<ModelUpdate> &
          Pick<ModelUpdate, "model_id" | "update_type" | "title">;
        Update: Partial<ModelUpdate>;
        Relationships: [];
      };
      tags: {
        Row: AsRow<Tag>;
        Insert: Partial<Tag> & Pick<Tag, "name" | "slug">;
        Update: Partial<Tag>;
        Relationships: [];
      };
      model_tags: {
        Row: { model_id: string; tag_id: number };
        Insert: { model_id: string; tag_id: number };
        Update: { model_id?: string; tag_id?: number };
        Relationships: [];
      };
      providers: {
        Row: AsRow<Provider>;
        Insert: Partial<Provider> & Pick<Provider, "slug" | "name">;
        Update: Partial<Provider>;
        Relationships: [];
      };
      model_snapshots: {
        Row: AsRow<ModelSnapshot>;
        Insert: Partial<ModelSnapshot> & Pick<ModelSnapshot, "model_id">;
        Update: Partial<ModelSnapshot>;
        Relationships: [];
      };
      profiles: {
        Row: AsRow<Profile>;
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          reputation_score?: number;
          is_admin?: boolean;
          is_banned?: boolean;
          is_seller?: boolean;
          seller_bio?: string | null;
          seller_website?: string | null;
          seller_verified?: boolean;
          total_sales?: number;
          seller_rating?: number | null;
          joined_at?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          reputation_score?: number;
          is_admin?: boolean;
          is_banned?: boolean;
          is_seller?: boolean;
          seller_bio?: string | null;
          seller_website?: string | null;
          seller_verified?: boolean;
          total_sales?: number;
          seller_rating?: number | null;
          joined_at?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_bookmarks: {
        Row: AsRow<UserBookmark>;
        Insert: {
          id?: string;
          user_id: string;
          model_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          model_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: AsRow<ModelComment>;
        Insert: {
          id?: string;
          model_id: string;
          user_id: string;
          parent_id?: string | null;
          content: string;
          upvotes?: number;
          is_edited?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          model_id?: string;
          user_id?: string;
          parent_id?: string | null;
          content?: string;
          upvotes?: number;
          is_edited?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_ratings: {
        Row: AsRow<UserRating>;
        Insert: {
          id?: string;
          user_id: string;
          model_id: string;
          score: number;
          review?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          model_id?: string;
          score?: number;
          review?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watchlists: {
        Row: AsRow<Watchlist>;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watchlist_items: {
        Row: AsRow<WatchlistItem>;
        Insert: {
          id?: string;
          watchlist_id: string;
          model_id: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          watchlist_id?: string;
          model_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      network_actors: {
        Row: AsRow<NetworkActor>;
        Insert: Partial<NetworkActor> & Pick<NetworkActor, "actor_type" | "owner_user_id" | "display_name" | "handle">;
        Update: Partial<NetworkActor>;
        Relationships: [];
      };
      social_communities: {
        Row: AsRow<SocialCommunity>;
        Insert: Partial<SocialCommunity> & Pick<SocialCommunity, "slug" | "name">;
        Update: Partial<SocialCommunity>;
        Relationships: [];
      };
      social_threads: {
        Row: AsRow<SocialThread>;
        Insert: Partial<SocialThread> & Pick<SocialThread, "created_by_actor_id">;
        Update: Partial<SocialThread>;
        Relationships: [];
      };
      social_posts: {
        Row: AsRow<SocialPost>;
        Insert: Partial<SocialPost> & Pick<SocialPost, "thread_id" | "author_actor_id" | "content">;
        Update: Partial<SocialPost>;
        Relationships: [];
      };
      social_post_media: {
        Row: AsRow<SocialPostMedia>;
        Insert: Partial<SocialPostMedia> & Pick<SocialPostMedia, "post_id" | "media_type" | "url">;
        Update: Partial<SocialPostMedia>;
        Relationships: [];
      };
      social_thread_blocks: {
        Row: AsRow<SocialThreadBlock>;
        Insert: Partial<SocialThreadBlock> & Pick<SocialThreadBlock, "thread_id" | "blocked_actor_id" | "blocked_by_actor_id">;
        Update: Partial<SocialThreadBlock>;
        Relationships: [];
      };
      social_post_reports: {
        Row: AsRow<SocialPostReport>;
        Insert: Partial<SocialPostReport> &
          Pick<SocialPostReport, "post_id" | "thread_id" | "reporter_actor_id" | "reason">;
        Update: Partial<SocialPostReport>;
        Relationships: [];
      };
      marketplace_listings: {
        Row: AsRow<MarketplaceListing>;
        Insert: Partial<MarketplaceListing> & Pick<MarketplaceListing, "seller_id" | "slug" | "title" | "description" | "listing_type">;
        Update: Partial<MarketplaceListing>;
        Relationships: [];
      };
      marketplace_reviews: {
        Row: AsRow<MarketplaceReview>;
        Insert: {
          id?: string;
          listing_id: string;
          reviewer_id: string;
          rating: number;
          title?: string | null;
          content?: string | null;
          is_verified_purchase?: boolean;
          upvotes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MarketplaceReview>;
        Relationships: [];
      };
      marketplace_orders: {
        Row: AsRow<MarketplaceOrder>;
        Insert: {
          id?: string;
          listing_id: string;
          buyer_id?: string | null;
          seller_id: string;
          status?: OrderStatus;
          message?: string | null;
          price_at_time?: number | null;
          delivery_data?: Record<string, unknown> | null;
          fulfillment_manifest_snapshot?: Record<string, unknown> | null;
          guest_email?: string | null;
          guest_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MarketplaceOrder>;
        Relationships: [];
      };
      notifications: {
        Row: AsRow<Notification>;
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Notification>;
        Relationships: [];
      };
      notification_preferences: {
        Row: AsRow<NotificationPreferences>;
        Insert: {
          user_id: string;
          email_model_updates?: boolean;
          email_watchlist_changes?: boolean;
          email_order_updates?: boolean;
          email_marketplace?: boolean;
          email_newsletter?: boolean;
          in_app_model_updates?: boolean;
          in_app_watchlist_changes?: boolean;
          in_app_order_updates?: boolean;
          in_app_marketplace?: boolean;
          updated_at?: string;
        };
        Update: Partial<NotificationPreferences>;
        Relationships: [];
      };
      data_sources: {
        Row: AsRow<DataSource>;
        Insert: Partial<DataSource> & Pick<DataSource, "slug" | "name" | "adapter_type">;
        Update: Partial<DataSource>;
        Relationships: [];
      };
      model_news: {
        Row: AsRow<ModelNews>;
        Insert: Partial<ModelNews> & Pick<ModelNews, "source" | "source_id" | "title" | "url" | "published_at">;
        Update: Partial<ModelNews>;
        Relationships: [];
      };
      sync_jobs: {
        Row: AsRow<SyncJob>;
        Insert: Partial<SyncJob> & Pick<SyncJob, "source" | "job_type" | "status">;
        Update: Partial<SyncJob>;
        Relationships: [];
      };
      agents: {
        Row: AsRow<Agent>;
        Insert: Partial<Agent> & Pick<Agent, "slug" | "name" | "agent_type">;
        Update: Partial<Agent>;
        Relationships: [];
      };
      agent_tasks: {
        Row: AsRow<AgentTask>;
        Insert: Partial<AgentTask> & Pick<AgentTask, "agent_id" | "task_type">;
        Update: Partial<AgentTask>;
        Relationships: [];
      };
      agent_logs: {
        Row: AsRow<AgentLog>;
        Insert: Partial<AgentLog> & Pick<AgentLog, "agent_id" | "level" | "message">;
        Update: Partial<AgentLog>;
        Relationships: [];
      };
      agent_issues: {
        Row: AsRow<AgentIssue>;
        Insert: Partial<AgentIssue> & Pick<AgentIssue, "slug" | "title" | "issue_type" | "severity" | "detected_by" | "evidence">;
        Update: Partial<AgentIssue>;
        Relationships: [];
      };
      agent_deferred_items: {
        Row: AsRow<AgentDeferredItem>;
        Insert: Partial<AgentDeferredItem> & Pick<AgentDeferredItem, "slug" | "title" | "area" | "reason" | "risk_level">;
        Update: Partial<AgentDeferredItem>;
        Relationships: [];
      };
      agent_provider_settings: {
        Row: AsRow<AgentProviderSetting>;
        Insert: Partial<AgentProviderSetting> & Pick<AgentProviderSetting, "provider" | "model_id">;
        Update: Partial<AgentProviderSetting>;
        Relationships: [];
      };
      api_keys: {
        Row: AsRow<ApiKeyRecord>;
        Insert: Partial<ApiKeyRecord> & Pick<ApiKeyRecord, "owner_id" | "name" | "key_prefix" | "key_hash">;
        Update: Partial<ApiKeyRecord>;
        Relationships: [];
      };
      agent_conversations: {
        Row: AsRow<AgentConversation>;
        Insert: Partial<AgentConversation> & Pick<AgentConversation, "participant_a" | "participant_b" | "participant_a_type" | "participant_b_type">;
        Update: Partial<AgentConversation>;
        Relationships: [];
      };
      agent_messages: {
        Row: AsRow<AgentMessage>;
        Insert: Partial<AgentMessage> & Pick<AgentMessage, "conversation_id" | "sender_id" | "sender_type" | "content">;
        Update: Partial<AgentMessage>;
        Relationships: [];
      };
      workspace_sessions: {
        Row: AsRow<WorkspaceSessionRecord>;
        Insert: Partial<WorkspaceSessionRecord> & Pick<WorkspaceSessionRecord, "user_id" | "workspace_state">;
        Update: Partial<WorkspaceSessionRecord>;
        Relationships: [];
      };
      workspace_runtimes: {
        Row: AsRow<WorkspaceRuntimeRecord>;
        Insert: Partial<WorkspaceRuntimeRecord> & Pick<WorkspaceRuntimeRecord, "user_id" | "model_slug" | "model_name" | "endpoint_slug">;
        Update: Partial<WorkspaceRuntimeRecord>;
        Relationships: [];
      };
      workspace_deployments: {
        Row: AsRow<WorkspaceDeploymentRecord>;
        Insert: Partial<WorkspaceDeploymentRecord> & Pick<WorkspaceDeploymentRecord, "user_id" | "model_slug" | "model_name" | "endpoint_slug">;
        Update: Partial<WorkspaceDeploymentRecord>;
        Relationships: [];
      };
      wallets: {
        Row: AsRow<Wallet>;
        Insert: Partial<Wallet> & Pick<Wallet, 'owner_id'>;
        Update: Partial<Wallet>;
        Relationships: [];
      };
      wallet_transactions: {
        Row: AsRow<WalletTransaction>;
        Insert: Partial<WalletTransaction> & Pick<WalletTransaction, 'wallet_id' | 'type' | 'amount' | 'net_amount'>;
        Update: Partial<WalletTransaction>;
        Relationships: [];
      };
      escrow_holds: {
        Row: AsRow<EscrowHold>;
        Insert: Partial<EscrowHold> & Pick<EscrowHold, 'wallet_id' | 'amount' | 'reason' | 'reference_type' | 'reference_id'>;
        Update: Partial<EscrowHold>;
        Relationships: [];
      };
      platform_fee_tiers: {
        Row: AsRow<PlatformFeeTier>;
        Insert: Partial<PlatformFeeTier> & Pick<PlatformFeeTier, 'min_lifetime_sales' | 'fee_percentage'>;
        Update: Partial<PlatformFeeTier>;
        Relationships: [];
      };
      api_endpoint_pricing: {
        Row: AsRow<ApiEndpointPricing>;
        Insert: Partial<ApiEndpointPricing> & Pick<ApiEndpointPricing, 'path_pattern' | 'price_per_call'>;
        Update: Partial<ApiEndpointPricing>;
        Relationships: [];
      };
      deployment_platforms: {
        Row: AsRow<DeploymentPlatform>;
        Insert: Partial<DeploymentPlatform> & Pick<DeploymentPlatform, 'slug' | 'name' | 'type' | 'base_url'>;
        Update: Partial<DeploymentPlatform>;
        Relationships: [];
      };
      model_deployments: {
        Row: AsRow<ModelDeployment>;
        Insert: Partial<ModelDeployment> & Pick<ModelDeployment, 'model_id' | 'platform_id'>;
        Update: Partial<ModelDeployment>;
        Relationships: [];
      };
      model_descriptions: {
        Row: AsRow<ModelDescription>;
        Insert: Partial<ModelDescription> & Pick<ModelDescription, 'model_id'>;
        Update: Partial<ModelDescription>;
        Relationships: [];
      };
      seller_verification_requests: {
        Row: AsRow<SellerVerificationRequest>;
        Insert: {
          id?: string;
          user_id: string;
          status?: VerificationStatus;
          business_name: string;
          business_description?: string | null;
          website_url?: string | null;
          portfolio_url?: string | null;
          reason?: string | null;
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SellerVerificationRequest>;
        Relationships: [];
      };
      order_messages: {
        Row: AsRow<OrderMessage>;
        Insert: {
          id?: string;
          order_id: string;
          sender_id: string;
          content: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<OrderMessage>;
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          category: string;
          subject: string;
          message: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          category?: string;
          subject: string;
          message: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          category?: string;
          subject?: string;
          message?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      listing_reports: {
        Row: {
          id: string;
          listing_id: string;
          reporter_id: string;
          reason: string;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          reporter_id: string;
          reason: string;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          reporter_id?: string;
          reason?: string;
          details?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      listing_policy_reviews: {
        Row: AsRow<ListingPolicyReview>;
        Insert: {
          id?: string;
          listing_id: string;
          seller_id: string;
          source_action: "create" | "update" | "manual_rescan";
          decision: MarketplacePolicyDecision;
          classifier_label: string;
          classifier_confidence?: number;
          reasons?: string[];
          content_risk_level?: MarketplaceContentRiskLevel;
          autonomy_risk_level?: MarketplaceAutonomyRiskLevel;
          purchase_mode?: MarketplacePurchaseMode;
          autonomy_mode?: MarketplaceAutonomyMode;
          reason_codes?: string[];
          matched_signals?: unknown;
          excerpt?: string | null;
          review_status?: ListingPolicyReviewStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ListingPolicyReview>;
        Relationships: [];
      };
      autonomous_commerce_policies: {
        Row: AsRow<AutonomousCommercePolicy>;
        Insert: {
          owner_id: string;
          is_enabled?: boolean;
          max_order_amount?: number;
          daily_spend_limit?: number;
          allowed_listing_types?: string[];
          require_verified_sellers?: boolean;
          block_flagged_listings?: boolean;
          require_manifest_snapshot?: boolean;
          allow_manual_only_listings?: boolean;
          max_autonomy_risk_level?: MarketplaceAutonomyRiskLevel;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AutonomousCommercePolicy>;
        Relationships: [];
      };
      auctions: {
        Row: {
          id: string;
          listing_id: string;
          seller_id: string;
          auction_type: "english" | "dutch" | "batch";
          status: "upcoming" | "active" | "ended" | "cancelled" | "settled";
          start_price: number;
          reserve_price: number | null;
          floor_price: number | null;
          current_price: number;
          bid_increment_min: number;
          price_decrement: number | null;
          decrement_interval_seconds: number | null;
          quantity: number;
          remaining_quantity: number;
          starts_at: string;
          ends_at: string;
          auto_extend_minutes: number;
          settled_at: string | null;
          winner_id: string | null;
          winning_bid_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          seller_id: string;
          auction_type: "english" | "dutch" | "batch";
          status?: "upcoming" | "active" | "ended" | "cancelled" | "settled";
          start_price: number;
          reserve_price?: number | null;
          floor_price?: number | null;
          current_price?: number;
          bid_increment_min?: number;
          price_decrement?: number | null;
          decrement_interval_seconds?: number | null;
          quantity?: number;
          remaining_quantity?: number;
          starts_at: string;
          ends_at: string;
          auto_extend_minutes?: number;
          settled_at?: string | null;
          winner_id?: string | null;
          winning_bid_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          seller_id?: string;
          auction_type?: "english" | "dutch" | "batch";
          status?: "upcoming" | "active" | "ended" | "cancelled" | "settled";
          start_price?: number;
          reserve_price?: number | null;
          floor_price?: number | null;
          current_price?: number;
          bid_increment_min?: number;
          price_decrement?: number | null;
          decrement_interval_seconds?: number | null;
          quantity?: number;
          remaining_quantity?: number;
          starts_at?: string;
          ends_at?: string;
          auto_extend_minutes?: number;
          settled_at?: string | null;
          winner_id?: string | null;
          winning_bid_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      auction_bids: {
        Row: {
          id: string;
          auction_id: string;
          bidder_id: string;
          bidder_type: "user" | "agent";
          bid_amount: number;
          quantity: number;
          status: "active" | "outbid" | "won" | "cancelled" | "refunded";
          escrow_hold_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auction_id: string;
          bidder_id: string;
          bidder_type?: "user" | "agent";
          bid_amount: number;
          quantity?: number;
          status?: "active" | "outbid" | "won" | "cancelled" | "refunded";
          escrow_hold_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auction_id?: string;
          bidder_id?: string;
          bidder_type?: "user" | "agent";
          bid_amount?: number;
          quantity?: number;
          status?: "active" | "outbid" | "won" | "cancelled" | "refunded";
          escrow_hold_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cron_runs: {
        Row: {
          id: string;
          job_name: string;
          status: "running" | "completed" | "failed";
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          result_summary: Record<string, unknown> | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_name: string;
          status?: "running" | "completed" | "failed";
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          result_summary?: Record<string, unknown> | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "running" | "completed" | "failed";
          finished_at?: string | null;
          duration_ms?: number | null;
          result_summary?: Record<string, unknown> | null;
          error_message?: string | null;
        };
        Relationships: [];
      };
      cron_job_locks: {
        Row: {
          job_name: string;
          lock_token: string;
          locked_at: string;
          expires_at: string;
          owner: string | null;
          updated_at: string;
        };
        Insert: {
          job_name: string;
          lock_token: string;
          locked_at?: string;
          expires_at: string;
          owner?: string | null;
          updated_at?: string;
        };
        Update: {
          job_name?: string;
          lock_token?: string;
          locked_at?: string;
          expires_at?: string;
          owner?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      system_logs: {
        Row: {
          id: string;
          level: "info" | "warn" | "error";
          source: string;
          message: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          level: "info" | "warn" | "error";
          source: string;
          message: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          level?: "info" | "warn" | "error";
          source?: string;
          message?: string;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      pipeline_health: {
        Row: {
          source_slug: string;
          last_success_at: string | null;
          consecutive_failures: number;
          expected_interval_hours: number;
          updated_at: string;
        };
        Insert: {
          source_slug: string;
          last_success_at?: string | null;
          consecutive_failures?: number;
          expected_interval_hours?: number;
          updated_at?: string;
        };
        Update: {
          source_slug?: string;
          last_success_at?: string | null;
          consecutive_failures?: number;
          expected_interval_hours?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      credit_wallet: {
        Args: {
          p_wallet_id: string;
          p_amount: number;
          p_tx_type: string;
          p_chain: string;
          p_tx_hash: string | null;
          p_token: string;
          p_reference_type: string | null;
          p_reference_id: string | null;
          p_description: string | null;
        };
        Returns: string;
      };
      debit_wallet: {
        Args: {
          p_wallet_id: string;
          p_amount: number;
          p_tx_type: string;
          p_reference_type: string | null;
          p_reference_id: string | null;
          p_description: string | null;
        };
        Returns: string;
      };
      hold_escrow: {
        Args: {
          p_wallet_id: string;
          p_amount: number;
          p_reason: string;
          p_reference_type: string;
          p_reference_id: string;
        };
        Returns: string;
      };
      release_escrow: {
        Args: {
          p_escrow_id: string;
          p_to_wallet_id: string;
          p_platform_fee: number;
        };
        Returns: void;
      };
      refund_escrow: {
        Args: {
          p_escrow_id: string;
        };
        Returns: void;
      };
      increment_seller_sales: {
        Args: {
          p_seller_id: string;
          p_amount: number;
        };
        Returns: void;
      };
      increment_listing_purchases: {
        Args: {
          p_listing_id: string;
        };
        Returns: void;
      };
      increment_view_count: {
        Args: {
          listing_id: string;
        };
        Returns: void;
      };
      acquire_cron_lock: {
        Args: {
          p_job_name: string;
          p_lock_token: string;
          p_ttl_seconds?: number;
        };
        Returns: boolean;
      };
      release_cron_lock: {
        Args: {
          p_job_name: string;
          p_lock_token: string;
        };
        Returns: boolean;
      };
      check_rate_limit: {
        Args: {
          p_bucket_key: string;
          p_max_requests: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          limit_count: number;
          remaining: number;
          reset: number;
        }[];
      };
    };
    Enums: {
      model_category: ModelCategory;
      model_status: ModelStatus;
      license_type: LicenseType;
      listing_type: ListingType;
      listing_status: ListingStatus;
      marketplace_pricing_type: MarketplacePricingType;
      order_status: OrderStatus;
      notification_type: NotificationType;
      agent_type: AgentType;
      agent_status: AgentStatus;
      task_status: TaskStatus;
      wallet_owner_type: WalletOwnerType;
      wallet_tx_type: WalletTxType;
      wallet_tx_status: WalletTxStatus;
      chain_type: ChainType;
      token_type: TokenType;
      escrow_status: EscrowStatus;
      escrow_reason: EscrowReason;
    };
  };
}

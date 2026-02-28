// Database types for Supabase
// These will be auto-generated later with `supabase gen types typescript`
// For now, manual types matching our schema

export type ModelCategory =
  | "llm"
  | "image_generation"
  | "vision"
  | "multimodal"
  | "embeddings"
  | "speech_audio"
  | "video"
  | "code"
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
  quality_score: number | null;
  value_score: number | null;
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
  last_sync_at: string | null;
  last_sync_status: DataSourceSyncStatus | null;
  last_sync_records: number;
  last_error_message: string | null;
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
  is_seller: boolean;
  seller_bio: string | null;
  seller_website: string | null;
  seller_verified: boolean;
  total_sales: number;
  seller_rating: number | null;
  joined_at: string | null;
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
  avg_rating: number | null;
  review_count: number;
  is_featured: boolean;
  agent_config?: Record<string, unknown> | null;
  mcp_manifest?: Record<string, unknown> | null;
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
        Row: Model;
        Insert: Partial<Model> & Pick<Model, "slug" | "name" | "provider" | "category">;
        Update: Partial<Model>;
      };
      benchmarks: {
        Row: Benchmark;
        Insert: Partial<Benchmark> & Pick<Benchmark, "slug" | "name">;
        Update: Partial<Benchmark>;
      };
      benchmark_scores: {
        Row: BenchmarkScore;
        Insert: Partial<BenchmarkScore> &
          Pick<BenchmarkScore, "model_id" | "benchmark_id" | "score">;
        Update: Partial<BenchmarkScore>;
      };
      model_pricing: {
        Row: ModelPricing;
        Insert: Partial<ModelPricing> &
          Pick<ModelPricing, "model_id" | "provider_name" | "pricing_model">;
        Update: Partial<ModelPricing>;
      };
      elo_ratings: {
        Row: EloRating;
        Insert: Partial<EloRating> &
          Pick<EloRating, "model_id" | "elo_score" | "snapshot_date">;
        Update: Partial<EloRating>;
      };
      rankings: {
        Row: Ranking;
        Insert: Partial<Ranking> & Pick<Ranking, "model_id" | "ranking_type" | "rank">;
        Update: Partial<Ranking>;
      };
      model_updates: {
        Row: ModelUpdate;
        Insert: Partial<ModelUpdate> &
          Pick<ModelUpdate, "model_id" | "update_type" | "title">;
        Update: Partial<ModelUpdate>;
      };
      tags: {
        Row: Tag;
        Insert: Partial<Tag> & Pick<Tag, "name" | "slug">;
        Update: Partial<Tag>;
      };
      model_tags: {
        Row: { model_id: string; tag_id: number };
        Insert: { model_id: string; tag_id: number };
        Update: { model_id?: string; tag_id?: number };
      };
      providers: {
        Row: Provider;
        Insert: Partial<Provider> & Pick<Provider, "slug" | "name">;
        Update: Partial<Provider>;
      };
      model_snapshots: {
        Row: ModelSnapshot;
        Insert: Partial<ModelSnapshot> & Pick<ModelSnapshot, "model_id">;
        Update: Partial<ModelSnapshot>;
      };
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          reputation_score?: number;
          is_admin?: boolean;
          is_seller?: boolean;
          seller_bio?: string | null;
          seller_website?: string | null;
          seller_verified?: boolean;
          total_sales?: number;
          seller_rating?: number | null;
          joined_at?: string | null;
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
          is_seller?: boolean;
          seller_bio?: string | null;
          seller_website?: string | null;
          seller_verified?: boolean;
          total_sales?: number;
          seller_rating?: number | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_bookmarks: {
        Row: UserBookmark;
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
        Row: ModelComment;
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
        Row: UserRating;
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
        Row: Watchlist;
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
        Row: WatchlistItem;
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
      marketplace_listings: {
        Row: MarketplaceListing;
        Insert: Partial<MarketplaceListing> & Pick<MarketplaceListing, "seller_id" | "slug" | "title" | "description" | "listing_type">;
        Update: Partial<MarketplaceListing>;
      };
      marketplace_reviews: {
        Row: MarketplaceReview;
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
      };
      marketplace_orders: {
        Row: MarketplaceOrder;
        Insert: {
          id?: string;
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          status?: OrderStatus;
          message?: string | null;
          price_at_time?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MarketplaceOrder>;
      };
      notifications: {
        Row: Notification;
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
      };
      notification_preferences: {
        Row: NotificationPreferences;
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
      };
      data_sources: {
        Row: DataSource;
        Insert: Partial<DataSource> & Pick<DataSource, "slug" | "name" | "adapter_type">;
        Update: Partial<DataSource>;
      };
      model_news: {
        Row: ModelNews;
        Insert: Partial<ModelNews> & Pick<ModelNews, "source" | "source_id" | "title" | "url" | "published_at">;
        Update: Partial<ModelNews>;
      };
      sync_jobs: {
        Row: SyncJob;
        Insert: Partial<SyncJob> & Pick<SyncJob, "source" | "job_type" | "status">;
        Update: Partial<SyncJob>;
      };
      agents: {
        Row: Agent;
        Insert: Partial<Agent> & Pick<Agent, "slug" | "name" | "agent_type">;
        Update: Partial<Agent>;
      };
      agent_tasks: {
        Row: AgentTask;
        Insert: Partial<AgentTask> & Pick<AgentTask, "agent_id" | "task_type">;
        Update: Partial<AgentTask>;
      };
      agent_logs: {
        Row: AgentLog;
        Insert: Partial<AgentLog> & Pick<AgentLog, "agent_id" | "level" | "message">;
        Update: Partial<AgentLog>;
      };
      api_keys: {
        Row: ApiKeyRecord;
        Insert: Partial<ApiKeyRecord> & Pick<ApiKeyRecord, "owner_id" | "name" | "key_prefix" | "key_hash">;
        Update: Partial<ApiKeyRecord>;
      };
      agent_conversations: {
        Row: AgentConversation;
        Insert: Partial<AgentConversation> & Pick<AgentConversation, "participant_a" | "participant_b" | "participant_a_type" | "participant_b_type">;
        Update: Partial<AgentConversation>;
      };
      agent_messages: {
        Row: AgentMessage;
        Insert: Partial<AgentMessage> & Pick<AgentMessage, "conversation_id" | "sender_id" | "sender_type" | "content">;
        Update: Partial<AgentMessage>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
    };
  };
}

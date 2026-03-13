-- Forward-only runtime schema repair for live environments.
-- This migration does not make 001-015 replayable from an empty database.
-- Use a baseline/bootstrap flow for clean environment provisioning.

-- ---------------------------------------------------------------------------
-- Enums used by agent infrastructure
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE agent_type AS ENUM ('resident', 'marketplace', 'visitor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE agent_status AS ENUM ('active', 'paused', 'disabled', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ---------------------------------------------------------------------------
-- Data sources
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_sources (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  tier INTEGER DEFAULT 1 CHECK (tier >= 0 AND tier <= 4),
  sync_interval_hours INTEGER DEFAULT 6 CHECK (sync_interval_hours > 0),
  priority INTEGER DEFAULT 50,
  config JSONB DEFAULT '{}',
  secret_env_keys TEXT[] DEFAULT '{}',
  output_types TEXT[] DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_sync_records INTEGER DEFAULT 0,
  last_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_tier_enabled
  ON data_sources (tier, is_enabled);
CREATE INDEX IF NOT EXISTS idx_data_sources_adapter_type
  ON data_sources (adapter_type);

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read data_sources" ON data_sources;
CREATE POLICY "Public can read data_sources"
  ON data_sources FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages data_sources" ON data_sources;
CREATE POLICY "Service role manages data_sources"
  ON data_sources FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS data_sources_updated_at ON data_sources;
CREATE TRIGGER data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- Model snapshots and news helpers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS model_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quality_score NUMERIC,
  value_score NUMERIC,
  popularity_score NUMERIC,
  overall_rank INTEGER,
  hf_downloads BIGINT DEFAULT 0,
  hf_likes INTEGER DEFAULT 0,
  market_cap_estimate NUMERIC,
  agent_score NUMERIC,
  capability_score NUMERIC,
  usage_score NUMERIC,
  expert_score NUMERIC,
  signal_coverage JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (model_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_model_snapshots_model_date
  ON model_snapshots (model_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_model_snapshots_snapshot_date
  ON model_snapshots (snapshot_date DESC);

ALTER TABLE model_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read model_snapshots" ON model_snapshots;
CREATE POLICY "Public can read model_snapshots"
  ON model_snapshots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages model_snapshots" ON model_snapshots;
CREATE POLICY "Service role manages model_snapshots"
  ON model_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_model_news_related_model_ids
  ON model_news USING gin (related_model_ids);
CREATE INDEX IF NOT EXISTS idx_model_news_published_category
  ON model_news (published_at DESC, category);

CREATE OR REPLACE FUNCTION get_most_discussed_models(
  days_back integer DEFAULT 30,
  result_limit integer DEFAULT 10
)
RETURNS TABLE (
  model_id uuid,
  mention_count bigint,
  model_name text,
  model_slug text,
  model_provider text,
  quality_score numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id AS model_id,
    count(mn.id) AS mention_count,
    m.name AS model_name,
    m.slug AS model_slug,
    m.provider AS model_provider,
    m.quality_score
  FROM models m
  JOIN model_news mn ON m.id = ANY(mn.related_model_ids)
  WHERE mn.published_at >= now() - make_interval(days => days_back)
    AND m.status = 'active'
  GROUP BY m.id, m.name, m.slug, m.provider, m.quality_score
  ORDER BY count(mn.id) DESC
  LIMIT result_limit;
$$;

-- ---------------------------------------------------------------------------
-- Notification preferences and bookmarks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_model_updates BOOLEAN DEFAULT true,
  email_watchlist_changes BOOLEAN DEFAULT true,
  email_order_updates BOOLEAN DEFAULT true,
  email_marketplace BOOLEAN DEFAULT false,
  email_newsletter BOOLEAN DEFAULT true,
  in_app_model_updates BOOLEAN DEFAULT true,
  in_app_watchlist_changes BOOLEAN DEFAULT true,
  in_app_order_updates BOOLEAN DEFAULT true,
  in_app_marketplace BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages notification preferences" ON notification_preferences;
CREATE POLICY "Service role manages notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id
  ON user_bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_model_id
  ON user_bookmarks (model_id);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bookmarks" ON user_bookmarks;
CREATE POLICY "Users manage own bookmarks"
  ON user_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages bookmarks" ON user_bookmarks;
CREATE POLICY "Service role manages bookmarks"
  ON user_bookmarks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, model_id)
);

ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own ratings" ON user_ratings;
CREATE POLICY "Users manage own ratings"
  ON user_ratings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages ratings" ON user_ratings;
CREATE POLICY "Service role manages ratings"
  ON user_ratings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS user_ratings_updated_at ON user_ratings;
CREATE TRIGGER user_ratings_updated_at
  BEFORE UPDATE ON user_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- Watchlists
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id
  ON watchlists (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlists_is_public
  ON watchlists (is_public, updated_at DESC)
  WHERE is_public = true;

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public or own watchlists" ON watchlists;
CREATE POLICY "Users can view public or own watchlists"
  ON watchlists FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own watchlists" ON watchlists;
CREATE POLICY "Users manage own watchlists"
  ON watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages watchlists" ON watchlists;
CREATE POLICY "Service role manages watchlists"
  ON watchlists FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS watchlists_updated_at ON watchlists;
CREATE TRIGGER watchlists_updated_at
  BEFORE UPDATE ON watchlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (watchlist_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id
  ON watchlist_items (watchlist_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_model_id
  ON watchlist_items (model_id);

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view watchlist items they can access" ON watchlist_items;
CREATE POLICY "Users can view watchlist items they can access"
  ON watchlist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
        AND (watchlists.is_public = true OR watchlists.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users manage items in own watchlists" ON watchlist_items;
CREATE POLICY "Users manage items in own watchlists"
  ON watchlist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
        AND watchlists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
        AND watchlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages watchlist items" ON watchlist_items;
CREATE POLICY "Service role manages watchlist items"
  ON watchlist_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Marketplace support tables and counters
-- ---------------------------------------------------------------------------

ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_id
  ON order_messages (order_id, created_at ASC);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order participants can read messages" ON order_messages;
CREATE POLICY "Order participants can read messages"
  ON order_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM marketplace_orders
      WHERE marketplace_orders.id = order_messages.order_id
        AND (marketplace_orders.buyer_id = auth.uid() OR marketplace_orders.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Order participants can write messages" ON order_messages;
CREATE POLICY "Order participants can write messages"
  ON order_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM marketplace_orders
      WHERE marketplace_orders.id = order_messages.order_id
        AND (marketplace_orders.buyer_id = auth.uid() OR marketplace_orders.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Order participants can update message reads" ON order_messages;
CREATE POLICY "Order participants can update message reads"
  ON order_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM marketplace_orders
      WHERE marketplace_orders.id = order_messages.order_id
        AND (marketplace_orders.buyer_id = auth.uid() OR marketplace_orders.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM marketplace_orders
      WHERE marketplace_orders.id = order_messages.order_id
        AND (marketplace_orders.buyer_id = auth.uid() OR marketplace_orders.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Service role manages order messages" ON order_messages;
CREATE POLICY "Service role manages order messages"
  ON order_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (listing_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_reports_listing_id
  ON listing_reports (listing_id, created_at DESC);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own listing reports" ON listing_reports;
CREATE POLICY "Users can create own listing reports"
  ON listing_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own listing reports" ON listing_reports;
CREATE POLICY "Users can view own listing reports"
  ON listing_reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role manages listing reports" ON listing_reports;
CREATE POLICY "Service role manages listing reports"
  ON listing_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION increment_listing_purchases(
  p_listing_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE marketplace_listings
  SET purchase_count = COALESCE(purchase_count, 0) + 1,
      updated_at = now()
  WHERE id = p_listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_view_count(
  listing_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE marketplace_listings
  SET view_count = COALESCE(view_count, 0) + 1,
      updated_at = now()
  WHERE id = increment_view_count.listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_listing_purchases(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Agent infrastructure
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  agent_type agent_type NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status agent_status NOT NULL DEFAULT 'active',
  capabilities TEXT[] DEFAULT '{}',
  config JSONB DEFAULT '{}',
  mcp_endpoint TEXT,
  api_key_hash TEXT,
  last_active_at TIMESTAMPTZ,
  total_tasks_completed INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  input JSONB DEFAULT '{}',
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a UUID NOT NULL,
  participant_b UUID NOT NULL,
  participant_a_type TEXT NOT NULL CHECK (participant_a_type IN ('agent', 'user')),
  participant_b_type TEXT NOT NULL CHECK (participant_b_type IN ('agent', 'user')),
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'user')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'tool_call', 'tool_result', 'system')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_status_type
  ON agents (status, agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_created
  ON agent_tasks (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_created
  ON agent_logs (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated
  ON agent_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created
  ON agent_messages (conversation_id, created_at ASC);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active agents" ON agents;
CREATE POLICY "Public can view active agents"
  ON agents FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Admins can manage agents" ON agents;
CREATE POLICY "Admins can manage agents"
  ON agents FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can view agent tasks" ON agent_tasks;
CREATE POLICY "Admins can view agent tasks"
  ON agent_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can view agent logs" ON agent_logs;
CREATE POLICY "Admins can view agent logs"
  ON agent_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role manages agents" ON agents;
CREATE POLICY "Service role manages agents"
  ON agents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages agent tasks" ON agent_tasks;
CREATE POLICY "Service role manages agent tasks"
  ON agent_tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages agent logs" ON agent_logs;
CREATE POLICY "Service role manages agent logs"
  ON agent_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages agent conversations" ON agent_conversations;
CREATE POLICY "Service role manages agent conversations"
  ON agent_conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages agent messages" ON agent_messages;
CREATE POLICY "Service role manages agent messages"
  ON agent_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_conversations_updated_at ON agent_conversations;
CREATE TRIGGER agent_conversations_updated_at
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

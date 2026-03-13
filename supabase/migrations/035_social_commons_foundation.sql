-- Unified actors + social commons foundation for human and agent discussion.

CREATE TABLE IF NOT EXISTS network_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'organization_agent', 'hybrid')),
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  trust_tier TEXT NOT NULL DEFAULT 'basic' CHECK (trust_tier IN ('basic', 'trusted', 'verified')),
  reputation_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  autonomy_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_by_actor_id UUID REFERENCES network_actors(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_actor_id UUID NOT NULL REFERENCES network_actors(id) ON DELETE CASCADE,
  community_id UUID REFERENCES social_communities(id) ON DELETE SET NULL,
  title TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'community')),
  language_code TEXT,
  reply_count INTEGER NOT NULL DEFAULT 0,
  last_posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES social_threads(id) ON DELETE CASCADE,
  parent_post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  author_actor_id UUID NOT NULL REFERENCES network_actors(id) ON DELETE CASCADE,
  community_id UUID REFERENCES social_communities(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  language_code TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  reply_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE social_threads
  ADD COLUMN IF NOT EXISTS root_post_id UUID UNIQUE REFERENCES social_posts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS social_post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'link_preview')),
  url TEXT NOT NULL,
  alt_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_thread_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES social_threads(id) ON DELETE CASCADE,
  blocked_actor_id UUID NOT NULL REFERENCES network_actors(id) ON DELETE CASCADE,
  blocked_by_actor_id UUID NOT NULL REFERENCES network_actors(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'thread_owner_block'
    CHECK (reason IN ('thread_owner_block', 'spam', 'abuse')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(thread_id, blocked_actor_id)
);

CREATE INDEX IF NOT EXISTS idx_network_actors_owner_type
  ON network_actors (owner_user_id, actor_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_threads_community_last
  ON social_threads (community_id, last_posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_thread_created
  ON social_posts (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_social_posts_parent_created
  ON social_posts (parent_post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_social_posts_community_created
  ON social_posts (community_id, created_at DESC);

ALTER TABLE network_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_thread_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read network actors" ON network_actors;
CREATE POLICY "Public can read network actors"
  ON network_actors FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "Public can read social communities" ON social_communities;
CREATE POLICY "Public can read social communities"
  ON social_communities FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can read social threads" ON social_threads;
CREATE POLICY "Public can read social threads"
  ON social_threads FOR SELECT
  USING (visibility IN ('public', 'community'));

DROP POLICY IF EXISTS "Public can read social posts" ON social_posts;
CREATE POLICY "Public can read social posts"
  ON social_posts FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Public can read social post media" ON social_post_media;
CREATE POLICY "Public can read social post media"
  ON social_post_media FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages network actors" ON network_actors;
CREATE POLICY "Service role manages network actors"
  ON network_actors FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages social communities" ON social_communities;
CREATE POLICY "Service role manages social communities"
  ON social_communities FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages social threads" ON social_threads;
CREATE POLICY "Service role manages social threads"
  ON social_threads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages social posts" ON social_posts;
CREATE POLICY "Service role manages social posts"
  ON social_posts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages social post media" ON social_post_media;
CREATE POLICY "Service role manages social post media"
  ON social_post_media FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages social thread blocks" ON social_thread_blocks;
CREATE POLICY "Service role manages social thread blocks"
  ON social_thread_blocks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS network_actors_updated_at ON network_actors;
CREATE TRIGGER network_actors_updated_at
  BEFORE UPDATE ON network_actors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS social_communities_updated_at ON social_communities;
CREATE TRIGGER social_communities_updated_at
  BEFORE UPDATE ON social_communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS social_threads_updated_at ON social_threads;
CREATE TRIGGER social_threads_updated_at
  BEFORE UPDATE ON social_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS social_posts_updated_at ON social_posts;
CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO social_communities (slug, name, description, is_global)
VALUES
  ('global', 'Global', 'The default public feed for humans and agents.', true),
  ('marketplace', 'Marketplace', 'Listings, launches, deals, and transaction discussion.', false),
  ('agents', 'Agents', 'Agent builds, tools, behaviors, and field reports.', false),
  ('models', 'Models', 'Model launches, evaluations, use cases, and comparisons.', false),
  ('off-topic', 'Off Topic', 'Casual discussion, experiments, and free-form conversation.', false)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_global = EXCLUDED.is_global,
  updated_at = now();

CREATE TABLE IF NOT EXISTS model_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  category TEXT DEFAULT 'general',
  related_model_ids UUID[],
  related_provider TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_model_news_source
  ON model_news (source, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_news_published
  ON model_news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_news_provider
  ON model_news (related_provider);

ALTER TABLE model_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read model_news"
  ON model_news FOR SELECT
  USING (true);

CREATE POLICY "Service role manages model_news"
  ON model_news FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

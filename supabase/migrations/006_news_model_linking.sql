-- News-to-Model Linking Infrastructure
-- GIN index for array containment queries on related_model_ids
CREATE INDEX IF NOT EXISTS idx_model_news_related_model_ids
  ON model_news USING gin (related_model_ids);

-- Composite index for chronological news with category filtering
CREATE INDEX IF NOT EXISTS idx_model_news_published_category
  ON model_news (published_at DESC, category);

-- RPC function: get most discussed models by news mentions
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
) AS $$
  SELECT
    m.id as model_id,
    count(mn.id) as mention_count,
    m.name as model_name,
    m.slug as model_slug,
    m.provider as model_provider,
    m.quality_score
  FROM models m
  JOIN model_news mn ON m.id = ANY(mn.related_model_ids)
  WHERE mn.published_at >= now() - make_interval(days => days_back)
    AND m.status = 'active'
  GROUP BY m.id, m.name, m.slug, m.provider, m.quality_score
  ORDER BY count(mn.id) DESC
  LIMIT result_limit;
$$ LANGUAGE sql STABLE;

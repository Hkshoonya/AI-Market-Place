CREATE OR REPLACE FUNCTION bulk_update_model_scores(p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_updates) > 500 THEN
    RAISE EXCEPTION 'p_updates cannot contain more than 500 records' USING ERRCODE = '22023';
  END IF;

  WITH parsed_updates AS (
    SELECT *
    FROM jsonb_to_recordset(p_updates) AS updates(
      id UUID,
      quality_score NUMERIC,
      popularity_score NUMERIC,
      capability_score NUMERIC,
      capability_rank INTEGER,
      agent_score NUMERIC,
      agent_rank INTEGER,
      popularity_rank INTEGER,
      market_cap_estimate NUMERIC,
      usage_score NUMERIC,
      usage_rank INTEGER,
      expert_score NUMERIC,
      expert_rank INTEGER,
      balanced_rank INTEGER,
      overall_rank INTEGER,
      category_rank INTEGER,
      value_score NUMERIC,
      adoption_score NUMERIC,
      adoption_rank INTEGER,
      economic_footprint_score NUMERIC,
      economic_footprint_rank INTEGER
    )
  ), deduplicated_updates AS (
    SELECT DISTINCT ON (id) *
    FROM parsed_updates
    WHERE id IS NOT NULL
  )
  UPDATE models AS model
  SET
    quality_score = updates.quality_score,
    popularity_score = updates.popularity_score,
    capability_score = updates.capability_score,
    capability_rank = updates.capability_rank,
    agent_score = updates.agent_score,
    agent_rank = updates.agent_rank,
    popularity_rank = updates.popularity_rank,
    market_cap_estimate = updates.market_cap_estimate,
    usage_score = updates.usage_score,
    usage_rank = updates.usage_rank,
    expert_score = updates.expert_score,
    expert_rank = updates.expert_rank,
    balanced_rank = updates.balanced_rank,
    overall_rank = updates.overall_rank,
    category_rank = updates.category_rank,
    value_score = updates.value_score,
    adoption_score = updates.adoption_score,
    adoption_rank = updates.adoption_rank,
    economic_footprint_score = updates.economic_footprint_score,
    economic_footprint_rank = updates.economic_footprint_rank,
    updated_at = NOW()
  FROM deduplicated_updates AS updates
  WHERE model.id = updates.id
    AND ROW(
      model.quality_score,
      model.popularity_score,
      model.capability_score,
      model.capability_rank,
      model.agent_score,
      model.agent_rank,
      model.popularity_rank,
      model.market_cap_estimate,
      model.usage_score,
      model.usage_rank,
      model.expert_score,
      model.expert_rank,
      model.balanced_rank,
      model.overall_rank,
      model.category_rank,
      model.value_score,
      model.adoption_score,
      model.adoption_rank,
      model.economic_footprint_score,
      model.economic_footprint_rank
    ) IS DISTINCT FROM ROW(
      updates.quality_score,
      updates.popularity_score,
      updates.capability_score,
      updates.capability_rank,
      updates.agent_score,
      updates.agent_rank,
      updates.popularity_rank,
      updates.market_cap_estimate,
      updates.usage_score,
      updates.usage_rank,
      updates.expert_score,
      updates.expert_rank,
      updates.balanced_rank,
      updates.overall_rank,
      updates.category_rank,
      updates.value_score,
      updates.adoption_score,
      updates.adoption_rank,
      updates.economic_footprint_score,
      updates.economic_footprint_rank
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION bulk_update_model_scores(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_update_model_scores(JSONB) FROM anon;
REVOKE ALL ON FUNCTION bulk_update_model_scores(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_model_scores(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION skip_unchanged_model_news_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS model_news_skip_unchanged_update ON model_news;
CREATE TRIGGER model_news_skip_unchanged_update
  BEFORE UPDATE ON model_news
  FOR EACH ROW
  EXECUTE FUNCTION skip_unchanged_model_news_update();

CREATE INDEX IF NOT EXISTS idx_agent_logs_created
  ON agent_logs (created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created
  ON agent_tasks (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created
  ON sync_jobs (created_at ASC);

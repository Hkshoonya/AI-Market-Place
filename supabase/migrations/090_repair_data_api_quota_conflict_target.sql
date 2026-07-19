CREATE OR REPLACE FUNCTION consume_data_api_quota(
  p_user_id UUID,
  p_api_key_id UUID,
  p_endpoint TEXT
)
RETURNS TABLE (
  allowed BOOLEAN,
  plan_slug TEXT,
  request_count BIGINT,
  request_limit BIGINT,
  rate_limit_per_minute INTEGER,
  period_start DATE,
  period_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan data_api_plans%ROWTYPE;
  v_period_start DATE := date_trunc('month', NOW() AT TIME ZONE 'UTC')::DATE;
  v_period_end DATE := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month')::DATE;
  v_request_count BIGINT;
  v_consumed BOOLEAN := FALSE;
BEGIN
  SELECT plan.*
  INTO v_plan
  FROM data_api_plans plan
  WHERE plan.slug = COALESCE(
    (
      SELECT subscription.plan_slug
      FROM data_api_subscriptions subscription
      WHERE subscription.user_id = p_user_id
        AND subscription.status IN ('active', 'trialing')
        AND (
          subscription.current_period_end IS NULL
          OR subscription.current_period_end > NOW()
        )
      LIMIT 1
    ),
    'free'
  )
    AND plan.is_active
  LIMIT 1;

  IF v_plan.slug IS NULL THEN
    RETURN QUERY SELECT FALSE, 'unavailable'::TEXT, 0::BIGINT, 0::BIGINT, 0, v_period_start, v_period_end;
    RETURN;
  END IF;

  INSERT INTO data_api_usage_monthly (
    user_id,
    period_start,
    request_count,
    last_api_key_id,
    last_endpoint,
    last_request_at
  )
  VALUES (p_user_id, v_period_start, 0, p_api_key_id, LEFT(p_endpoint, 300), NOW())
  ON CONFLICT ON CONSTRAINT data_api_usage_monthly_pkey DO NOTHING;

  UPDATE data_api_usage_monthly usage
  SET
    request_count = usage.request_count + 1,
    last_api_key_id = p_api_key_id,
    last_endpoint = LEFT(p_endpoint, 300),
    last_request_at = NOW(),
    updated_at = NOW()
  WHERE usage.user_id = p_user_id
    AND usage.period_start = v_period_start
    AND usage.request_count < v_plan.monthly_request_limit
  RETURNING usage.request_count INTO v_request_count;

  v_consumed := FOUND;

  IF NOT v_consumed THEN
    SELECT usage.request_count
    INTO v_request_count
    FROM data_api_usage_monthly usage
    WHERE usage.user_id = p_user_id
      AND usage.period_start = v_period_start;
  END IF;

  RETURN QUERY SELECT
    v_consumed,
    v_plan.slug,
    COALESCE(v_request_count, 0),
    v_plan.monthly_request_limit,
    v_plan.rate_limit_per_minute,
    v_period_start,
    v_period_end;
END;
$$;

REVOKE ALL ON FUNCTION consume_data_api_quota(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_data_api_quota(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION consume_data_api_quota(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION consume_data_api_quota(UUID, UUID, TEXT) TO service_role;

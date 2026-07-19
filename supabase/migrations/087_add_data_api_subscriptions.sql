CREATE TABLE IF NOT EXISTS data_api_plans (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  monthly_request_limit BIGINT NOT NULL CHECK (monthly_request_limit > 0),
  rate_limit_per_minute INTEGER NOT NULL CHECK (rate_limit_per_minute > 0),
  max_page_size INTEGER NOT NULL CHECK (max_page_size > 0),
  history_days INTEGER NOT NULL CHECK (history_days > 0),
  features JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_api_plans (
  slug,
  name,
  description,
  monthly_price_cents,
  monthly_request_limit,
  rate_limit_per_minute,
  max_page_size,
  history_days,
  features,
  is_public,
  is_active,
  checkout_enabled
)
VALUES
  (
    'free',
    'Explorer',
    'A free developer tier for evaluation, personal tools, and research.',
    0,
    2500,
    30,
    100,
    30,
    '["Models and rankings", "30 days of historical data", "Community support"]'::JSONB,
    TRUE,
    TRUE,
    FALSE
  ),
  (
    'pro',
    'Data Pro',
    'Higher-volume access for products, analysts, and production prototypes.',
    4900,
    100000,
    300,
    500,
    365,
    '["All public datasets", "One year of history", "Higher rate limits", "Email support"]'::JSONB,
    TRUE,
    TRUE,
    FALSE
  ),
  (
    'business',
    'Data Business',
    'Production data access for teams and commercial applications.',
    19900,
    1000000,
    1000,
    1000,
    365,
    '["All public datasets", "One year of history", "Commercial use", "Priority support"]'::JSONB,
    TRUE,
    TRUE,
    FALSE
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  monthly_request_limit = EXCLUDED.monthly_request_limit,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  max_page_size = EXCLUDED.max_page_size,
  history_days = EXCLUDED.history_days,
  features = EXCLUDED.features,
  is_public = EXCLUDED.is_public,
  is_active = EXCLUDED.is_active,
  checkout_enabled = EXCLUDED.checkout_enabled,
  updated_at = NOW();

INSERT INTO api_endpoint_pricing (
  path_pattern,
  method,
  price_per_call,
  is_free_for_humans,
  rate_limit_free,
  rate_limit_paid,
  description
)
SELECT
  '^/api/models/[^/]+/history$',
  'GET',
  0,
  TRUE,
  10,
  300,
  'Get model score and rank history'
WHERE NOT EXISTS (
  SELECT 1
  FROM api_endpoint_pricing
  WHERE path_pattern = '^/api/models/[^/]+/history$'
    AND method = 'GET'
);

CREATE TABLE IF NOT EXISTS data_api_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL REFERENCES data_api_plans(slug),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  source TEXT NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'stripe', 'promotion', 'migration')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  external_customer_id TEXT,
  external_subscription_id TEXT,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_api_subscriptions_status_period
  ON data_api_subscriptions (status, current_period_end);

CREATE TABLE IF NOT EXISTS data_api_usage_monthly (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  request_count BIGINT NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  last_endpoint TEXT,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, period_start)
);

ALTER TABLE data_api_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_api_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_api_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active public data API plans" ON data_api_plans;
CREATE POLICY "Anyone reads active public data API plans"
  ON data_api_plans FOR SELECT
  USING (is_active AND is_public);

DROP POLICY IF EXISTS "Users read own data API subscription" ON data_api_subscriptions;
CREATE POLICY "Users read own data API subscription"
  ON data_api_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own data API usage" ON data_api_usage_monthly;
CREATE POLICY "Users read own data API usage"
  ON data_api_usage_monthly FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages data API plans" ON data_api_plans;
CREATE POLICY "Service role manages data API plans"
  ON data_api_plans FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages data API subscriptions" ON data_api_subscriptions;
CREATE POLICY "Service role manages data API subscriptions"
  ON data_api_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages data API usage" ON data_api_usage_monthly;
CREATE POLICY "Service role manages data API usage"
  ON data_api_usage_monthly FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS data_api_plans_updated_at ON data_api_plans;
CREATE TRIGGER data_api_plans_updated_at
  BEFORE UPDATE ON data_api_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS data_api_subscriptions_updated_at ON data_api_subscriptions;
CREATE TRIGGER data_api_subscriptions_updated_at
  BEFORE UPDATE ON data_api_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS data_api_usage_monthly_updated_at ON data_api_usage_monthly;
CREATE TRIGGER data_api_usage_monthly_updated_at
  BEFORE UPDATE ON data_api_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
  ON CONFLICT (user_id, period_start) DO NOTHING;

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

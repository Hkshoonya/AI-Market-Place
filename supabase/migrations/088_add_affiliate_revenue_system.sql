-- Legacy columns were present in source migrations but are absent from the live
-- project. Add them for compatibility, but never seed unverified referral URLs.
ALTER TABLE deployment_platforms
  ADD COLUMN IF NOT EXISTS affiliate_url TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_tag TEXT;

CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES deployment_platforms(id) ON DELETE CASCADE,
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  destination_url TEXT NOT NULL CHECK (
    char_length(destination_url) <= 2000
    AND destination_url ~ '^https://'
  ),
  program_name TEXT NOT NULL CHECK (char_length(program_name) BETWEEN 2 AND 120),
  campaign_name TEXT,
  commission_details TEXT,
  disclosure_text TEXT NOT NULL DEFAULT 'Partner-supported link',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'invalid')),
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 10000),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  last_check_status TEXT CHECK (last_check_status IS NULL OR last_check_status IN ('healthy', 'redirected', 'failed')),
  last_http_status INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_links_platform_default
  ON affiliate_links (platform_id)
  WHERE model_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_links_platform_model
  ON affiliate_links (platform_id, model_id)
  WHERE model_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_links_active_lookup
  ON affiliate_links (platform_id, model_id, priority, updated_at DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS affiliate_click_daily (
  affiliate_link_id UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
  click_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::DATE,
  source TEXT NOT NULL DEFAULT 'unknown' CHECK (char_length(source) BETWEEN 1 AND 80),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (affiliate_link_id, click_date, source)
);

ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_click_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages affiliate links" ON affiliate_links;
CREATE POLICY "Service role manages affiliate links"
  ON affiliate_links FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages affiliate click aggregates" ON affiliate_click_daily;
CREATE POLICY "Service role manages affiliate click aggregates"
  ON affiliate_click_daily FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS affiliate_links_updated_at ON affiliate_links;
CREATE TRIGGER affiliate_links_updated_at
  BEFORE UPDATE ON affiliate_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION record_affiliate_click(
  p_affiliate_link_id UUID,
  p_source TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT := LEFT(COALESCE(NULLIF(trim(p_source), ''), 'unknown'), 80);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM affiliate_links link
    WHERE link.id = p_affiliate_link_id
      AND link.status = 'active'
      AND (link.starts_at IS NULL OR link.starts_at <= NOW())
      AND (link.ends_at IS NULL OR link.ends_at > NOW())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO affiliate_click_daily (
    affiliate_link_id,
    click_date,
    source,
    clicks,
    updated_at
  )
  VALUES (
    p_affiliate_link_id,
    (NOW() AT TIME ZONE 'UTC')::DATE,
    v_source,
    1,
    NOW()
  )
  ON CONFLICT (affiliate_link_id, click_date, source)
  DO UPDATE SET
    clicks = affiliate_click_daily.clicks + 1,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION record_affiliate_click(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_affiliate_click(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION record_affiliate_click(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_affiliate_click(UUID, TEXT) TO service_role;

-- Existing flags were descriptive placeholders, not proof of a live agreement.
UPDATE deployment_platforms
SET
  has_affiliate = FALSE,
  affiliate_url = NULL,
  affiliate_tag = NULL,
  updated_at = NOW()
WHERE has_affiliate OR affiliate_url IS NOT NULL OR affiliate_tag IS NOT NULL;

INSERT INTO agents (
  slug,
  name,
  description,
  agent_type,
  status,
  capabilities,
  config
)
VALUES (
  'affiliate-maintainer',
  'Affiliate Link Maintainer',
  'Checks active referral destinations, records health, and pauses links only after repeated failures.',
  'resident',
  'active',
  jsonb_build_array('affiliate_link_health', 'redirect_validation', 'revenue_integrity'),
  jsonb_build_object(
    'failure_threshold', 3,
    'max_links_per_run', 100,
    'request_timeout_ms', 8000
  )
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  agent_type = EXCLUDED.agent_type,
  capabilities = EXCLUDED.capabilities,
  config = EXCLUDED.config,
  updated_at = NOW();

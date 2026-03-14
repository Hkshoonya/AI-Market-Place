-- Marketplace trust rails: deterministic listing policy reviews plus
-- configurable autonomous commerce guardrails.

CREATE TABLE IF NOT EXISTS listing_policy_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_action TEXT NOT NULL CHECK (source_action IN ('create', 'update', 'manual_rescan')),
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'review', 'block')),
  classifier_label TEXT NOT NULL,
  classifier_confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  matched_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  excerpt TEXT,
  review_status TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open', 'approved', 'rejected', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_policy_reviews_listing_created
  ON listing_policy_reviews (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_policy_reviews_open
  ON listing_policy_reviews (review_status, created_at DESC)
  WHERE review_status = 'open';

ALTER TABLE listing_policy_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view own listing policy reviews" ON listing_policy_reviews;
CREATE POLICY "Sellers can view own listing policy reviews"
  ON listing_policy_reviews FOR SELECT
  USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Sellers can create own listing policy reviews" ON listing_policy_reviews;
CREATE POLICY "Sellers can create own listing policy reviews"
  ON listing_policy_reviews FOR INSERT
  WITH CHECK (
    seller_id = auth.uid()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Sellers can update own listing policy reviews" ON listing_policy_reviews;
CREATE POLICY "Sellers can update own listing policy reviews"
  ON listing_policy_reviews FOR UPDATE
  USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Service role manages listing policy reviews" ON listing_policy_reviews;
CREATE POLICY "Service role manages listing policy reviews"
  ON listing_policy_reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS listing_policy_reviews_updated_at ON listing_policy_reviews;
CREATE TRIGGER listing_policy_reviews_updated_at
  BEFORE UPDATE ON listing_policy_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS autonomous_commerce_policies (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  max_order_amount NUMERIC(12,2) NOT NULL DEFAULT 100,
  daily_spend_limit NUMERIC(12,2) NOT NULL DEFAULT 250,
  allowed_listing_types TEXT[] NOT NULL DEFAULT ARRAY[
    'api_access',
    'model_weights',
    'fine_tuned_model',
    'dataset',
    'prompt_template',
    'agent',
    'mcp_server'
  ]::TEXT[],
  require_verified_sellers BOOLEAN NOT NULL DEFAULT true,
  block_flagged_listings BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE autonomous_commerce_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own autonomous commerce policy" ON autonomous_commerce_policies;
CREATE POLICY "Owners can view own autonomous commerce policy"
  ON autonomous_commerce_policies FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Owners can insert own autonomous commerce policy" ON autonomous_commerce_policies;
CREATE POLICY "Owners can insert own autonomous commerce policy"
  ON autonomous_commerce_policies FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Owners can update own autonomous commerce policy" ON autonomous_commerce_policies;
CREATE POLICY "Owners can update own autonomous commerce policy"
  ON autonomous_commerce_policies FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Service role manages autonomous commerce policies" ON autonomous_commerce_policies;
CREATE POLICY "Service role manages autonomous commerce policies"
  ON autonomous_commerce_policies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS autonomous_commerce_policies_updated_at ON autonomous_commerce_policies;
CREATE TRIGGER autonomous_commerce_policies_updated_at
  BEFORE UPDATE ON autonomous_commerce_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'Marketplace listings now run through deterministic policy scans before public activation.'
  ),
  updated_at = now()
WHERE slug = 'illegal-goods-policy-engine';

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'API-key marketplace purchases now enforce spend caps, listing-type rules, verified-seller checks, and flagged-listing blocks.'
  ),
  updated_at = now()
WHERE slug = 'autonomous-commerce-guardrails';

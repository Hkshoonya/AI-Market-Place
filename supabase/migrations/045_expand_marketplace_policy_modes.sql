-- Expand marketplace policy outputs so content risk and autonomy risk
-- can be enforced separately.

ALTER TABLE listing_policy_reviews
  ADD COLUMN IF NOT EXISTS content_risk_level TEXT NOT NULL DEFAULT 'allow'
    CHECK (content_risk_level IN ('allow', 'review', 'block'));

ALTER TABLE listing_policy_reviews
  ADD COLUMN IF NOT EXISTS autonomy_risk_level TEXT NOT NULL DEFAULT 'allow'
    CHECK (autonomy_risk_level IN ('allow', 'manual_only', 'restricted', 'block'));

ALTER TABLE listing_policy_reviews
  ADD COLUMN IF NOT EXISTS purchase_mode TEXT NOT NULL DEFAULT 'public_purchase_allowed'
    CHECK (purchase_mode IN ('public_purchase_allowed', 'manual_review_required', 'purchase_blocked'));

ALTER TABLE listing_policy_reviews
  ADD COLUMN IF NOT EXISTS autonomy_mode TEXT NOT NULL DEFAULT 'autonomous_allowed'
    CHECK (autonomy_mode IN ('autonomous_allowed', 'manual_only', 'restricted', 'autonomous_blocked'));

ALTER TABLE listing_policy_reviews
  ADD COLUMN IF NOT EXISTS reason_codes TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE autonomous_commerce_policies
  ADD COLUMN IF NOT EXISTS require_manifest_snapshot BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE autonomous_commerce_policies
  ADD COLUMN IF NOT EXISTS allow_manual_only_listings BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE autonomous_commerce_policies
  ADD COLUMN IF NOT EXISTS max_autonomy_risk_level TEXT NOT NULL DEFAULT 'allow'
    CHECK (max_autonomy_risk_level IN ('allow', 'manual_only', 'restricted', 'block'));

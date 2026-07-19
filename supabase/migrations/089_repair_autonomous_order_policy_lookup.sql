CREATE OR REPLACE FUNCTION reserve_autonomous_marketplace_order(
  p_buyer_id UUID,
  p_listing_id UUID,
  p_expected_price NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  commerce_policy autonomous_commerce_policies%ROWTYPE;
  listing marketplace_listings%ROWTYPE;
  listing_autonomy_mode TEXT;
  listing_autonomy_risk_level TEXT;
  seller_is_verified BOOLEAN;
  current_price NUMERIC;
  spend_today NUMERIC;
  order_id UUID;
BEGIN
  IF p_buyer_id IS NULL OR p_listing_id IS NULL THEN
    RAISE EXCEPTION 'invalid_autonomous_purchase' USING ERRCODE = '22023';
  END IF;

  -- Serialize autonomous orders for one buyer so concurrent requests cannot
  -- independently pass spend or duplicate-order checks.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer_id::TEXT, 0));

  SELECT *
  INTO commerce_policy
  FROM autonomous_commerce_policies
  WHERE owner_id = p_buyer_id;

  IF NOT FOUND OR NOT commerce_policy.is_enabled THEN
    RAISE EXCEPTION 'autonomous_commerce_disabled' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO listing
  FROM marketplace_listings
  WHERE id = p_listing_id
    AND status = 'active'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_active' USING ERRCODE = 'P0001';
  END IF;

  IF listing.seller_id = p_buyer_id THEN
    RAISE EXCEPTION 'cannot_purchase_own_listing' USING ERRCODE = 'P0001';
  END IF;

  current_price := COALESCE(listing.price, 0);
  IF current_price <> COALESCE(p_expected_price, 0) THEN
    RAISE EXCEPTION 'listing_price_changed' USING ERRCODE = 'P0001';
  END IF;

  IF current_price > commerce_policy.max_order_amount THEN
    RAISE EXCEPTION 'max_order_amount_exceeded' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (listing.listing_type::TEXT = ANY(commerce_policy.allowed_listing_types)) THEN
    RAISE EXCEPTION 'listing_type_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  IF commerce_policy.require_verified_sellers THEN
    SELECT COALESCE(seller_verified, false)
    INTO seller_is_verified
    FROM profiles
    WHERE id = listing.seller_id;

    IF NOT COALESCE(seller_is_verified, false) THEN
      RAISE EXCEPTION 'seller_not_verified' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF commerce_policy.block_flagged_listings AND EXISTS (
    SELECT 1
    FROM listing_policy_reviews
    WHERE listing_id = listing.id
      AND review_status = 'open'
      AND decision IN ('review', 'block')
  ) THEN
    RAISE EXCEPTION 'listing_blocked_by_policy' USING ERRCODE = 'P0001';
  END IF;

  IF commerce_policy.require_manifest_snapshot
    AND listing.preview_manifest IS NULL THEN
    RAISE EXCEPTION 'manifest_snapshot_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT review.autonomy_mode, review.autonomy_risk_level
  INTO listing_autonomy_mode, listing_autonomy_risk_level
  FROM listing_policy_reviews review
  WHERE review.listing_id = listing.id
  ORDER BY review.updated_at DESC, review.created_at DESC, review.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_policy_missing' USING ERRCODE = 'P0001';
  END IF;

  IF listing_autonomy_mode = 'manual_only'
    AND NOT commerce_policy.allow_manual_only_listings THEN
    RAISE EXCEPTION 'listing_manual_only' USING ERRCODE = 'P0001';
  END IF;

  IF (CASE listing_autonomy_risk_level
      WHEN 'allow' THEN 0
      WHEN 'manual_only' THEN 1
      WHEN 'restricted' THEN 2
      ELSE 3
    END) > (CASE commerce_policy.max_autonomy_risk_level
      WHEN 'allow' THEN 0
      WHEN 'manual_only' THEN 1
      WHEN 'restricted' THEN 2
      ELSE 3
    END) THEN
    RAISE EXCEPTION 'autonomy_risk_too_high' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM marketplace_orders
    WHERE buyer_id = p_buyer_id
      AND listing_id = p_listing_id
      AND status IN ('pending', 'approved', 'completed')
  ) THEN
    RAISE EXCEPTION 'active_order_already_exists' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(price_at_time), 0)
  INTO spend_today
  FROM marketplace_orders
  WHERE buyer_id = p_buyer_id
    AND message = 'Purchased via API'
    AND status IN ('pending', 'approved', 'completed')
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF spend_today + current_price > commerce_policy.daily_spend_limit THEN
    RAISE EXCEPTION 'daily_spend_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO marketplace_orders (
    listing_id,
    buyer_id,
    seller_id,
    price_at_time,
    status,
    message
  ) VALUES (
    listing.id,
    p_buyer_id,
    listing.seller_id,
    current_price,
    'pending',
    'Purchased via API'
  )
  RETURNING id INTO order_id;

  RETURN order_id;
END;
$$;

REVOKE ALL ON FUNCTION reserve_autonomous_marketplace_order(UUID, UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION reserve_autonomous_marketplace_order(UUID, UUID, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION reserve_autonomous_marketplace_order(UUID, UUID, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION reserve_autonomous_marketplace_order(UUID, UUID, NUMERIC) TO service_role;

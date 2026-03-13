-- Enforce that only verified sellers can persist active marketplace listings.
-- Unverified sellers may still create and update draft listings.

DROP POLICY IF EXISTS "Sellers can create listings" ON marketplace_listings;
DROP POLICY IF EXISTS "Sellers can insert own listings" ON marketplace_listings;
CREATE POLICY "Sellers can insert own listings"
  ON marketplace_listings FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id
    AND (
      status <> 'active'
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.seller_verified = true
      )
    )
  );

DROP POLICY IF EXISTS "Sellers can update own listings" ON marketplace_listings;
CREATE POLICY "Sellers can update own listings"
  ON marketplace_listings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND (
      status <> 'active'
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.seller_verified = true
      )
    )
  );

-- Security RLS Migration: Add row-level security to all unprotected marketplace tables
-- Tables: profiles, marketplace_listings, marketplace_orders, marketplace_reviews,
--         api_keys, notifications, comments, seller_verification_requests

-- ============================================================
-- PROFILES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public directory)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update own profile, but cannot self-promote (is_admin, is_banned, seller_verified must stay same)
CREATE POLICY "Users can update own profile safely"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
    AND is_banned = (SELECT p.is_banned FROM profiles p WHERE p.id = auth.uid())
    AND seller_verified = (SELECT p.seller_verified FROM profiles p WHERE p.id = auth.uid())
  );

-- Service role can do anything
CREATE POLICY "Service role manages profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- MARKETPLACE LISTINGS
-- ============================================================
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can see active listings; sellers can see their own regardless of status
CREATE POLICY "Active listings are viewable by everyone"
  ON marketplace_listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

-- Sellers can insert their own listings
CREATE POLICY "Sellers can insert own listings"
  ON marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own listings
CREATE POLICY "Sellers can update own listings"
  ON marketplace_listings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can delete their own listings
CREATE POLICY "Sellers can delete own listings"
  ON marketplace_listings FOR DELETE
  USING (auth.uid() = seller_id);

-- Service role can do anything (admin operations)
CREATE POLICY "Service role manages listings"
  ON marketplace_listings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- MARKETPLACE ORDERS
-- ============================================================
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Buyers and sellers can view their own orders
CREATE POLICY "Users can view own orders"
  ON marketplace_orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Only service role can insert/update/delete orders (API routes use admin client)
CREATE POLICY "Service role manages orders"
  ON marketplace_orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- MARKETPLACE REVIEWS
-- ============================================================
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Reviews are viewable by everyone"
  ON marketplace_reviews FOR SELECT
  USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
  ON marketplace_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON marketplace_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON marketplace_reviews FOR DELETE
  USING (auth.uid() = reviewer_id);

-- Service role can do anything
CREATE POLICY "Service role manages reviews"
  ON marketplace_reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- API KEYS
-- ============================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own API keys
CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can insert their own API keys
CREATE POLICY "Users can insert own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = owner_id);

-- Service role can do anything
CREATE POLICY "Service role manages API keys"
  ON api_keys FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert notifications
CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role manages notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- COMMENTS
-- ============================================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can insert own comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role manages comments"
  ON comments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SELLER VERIFICATION REQUESTS
-- ============================================================
ALTER TABLE seller_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification requests
CREATE POLICY "Users can view own verification requests"
  ON seller_verification_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own verification requests
CREATE POLICY "Users can insert own verification requests"
  ON seller_verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do anything (admin reviews)
CREATE POLICY "Service role manages verification requests"
  ON seller_verification_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- UNIQUE INDEX: Prevent deposit double-credit
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_unique_hash
  ON wallet_transactions (tx_hash)
  WHERE tx_hash IS NOT NULL;

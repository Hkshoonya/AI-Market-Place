-- AI Market Cap: Auction System
-- Creates auction tables, bid tracking, indexes, RLS policies,
-- and triggers for English, Dutch, and Batch auction types.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE auction_type AS ENUM ('english', 'dutch', 'batch');
CREATE TYPE auction_status AS ENUM ('upcoming', 'active', 'ended', 'cancelled');
CREATE TYPE bid_status AS ENUM ('active', 'outbid', 'won', 'cancelled');

-- ============================================================
-- AUCTIONS
-- ============================================================

CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  auction_type auction_type NOT NULL,
  status auction_status DEFAULT 'upcoming',

  -- Pricing
  start_price DECIMAL(18,2) NOT NULL CHECK (start_price > 0),
  reserve_price DECIMAL(18,2),  -- Hidden minimum (English)
  floor_price DECIMAL(18,2),    -- Minimum price (Dutch)
  current_price DECIMAL(18,2),

  -- English auction config
  bid_increment_min DECIMAL(18,2) DEFAULT 1.00,

  -- Dutch auction config
  price_decrement DECIMAL(18,2),       -- How much to drop each interval
  decrement_interval_seconds INTEGER,  -- How often to drop

  -- Batch auction
  quantity INTEGER DEFAULT 1,
  remaining_quantity INTEGER DEFAULT 1,

  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  auto_extend_minutes INTEGER DEFAULT 5,

  -- Result
  winner_id UUID REFERENCES auth.users(id),
  final_price DECIMAL(18,2),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUCTION BIDS
-- ============================================================

CREATE TABLE auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id),
  bidder_type TEXT DEFAULT 'user' CHECK (bidder_type IN ('user', 'agent')),
  bid_amount DECIMAL(18,2) NOT NULL CHECK (bid_amount > 0),
  quantity INTEGER DEFAULT 1,
  escrow_hold_id UUID REFERENCES escrow_holds(id),
  status bid_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Auction settlement cron: find active auctions past their end time
CREATE INDEX idx_auctions_status_ends_at ON auctions (status, ends_at);

-- Lookup auctions by listing
CREATE INDEX idx_auctions_listing_id ON auctions (listing_id);

-- Lookup auctions by seller
CREATE INDEX idx_auctions_seller_id ON auctions (seller_id);

-- Bid lookup by bidder
CREATE INDEX idx_auction_bids_bidder_id ON auction_bids (bidder_id);

-- Bid lookup by auction + status (find active/winning bids)
CREATE INDEX idx_auction_bids_auction_status ON auction_bids (auction_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- auctions --------------------------------------------------------
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active and ended auctions"
  ON auctions FOR SELECT
  USING (status IN ('active', 'ended'));

CREATE POLICY "Sellers can view their own auctions"
  ON auctions FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Service role manages auctions"
  ON auctions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- auction_bids ----------------------------------------------------
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bids on active/ended auctions"
  ON auction_bids FOR SELECT
  USING (
    auction_id IN (
      SELECT id FROM auctions WHERE status IN ('active', 'ended')
    )
  );

CREATE POLICY "Users can view their own bids"
  ON auction_bids FOR SELECT
  USING (auth.uid() = bidder_id);

CREATE POLICY "Service role manages auction bids"
  ON auction_bids FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- TRIGGER: auctions updated_at
-- ============================================================

CREATE TRIGGER auctions_updated_at BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

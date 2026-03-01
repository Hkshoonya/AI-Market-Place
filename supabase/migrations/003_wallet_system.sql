-- AI Market Cap: Wallet System
-- Creates wallet, ledger, escrow, fee tiers, and API pricing tables
-- for the crypto payment system (Phase E foundation)

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE wallet_owner_type AS ENUM ('user', 'agent');

CREATE TYPE wallet_tx_type AS ENUM (
  'deposit', 'withdrawal', 'purchase', 'sale',
  'escrow_hold', 'escrow_release', 'bid_hold', 'bid_release',
  'refund', 'platform_fee', 'api_charge'
);

CREATE TYPE wallet_tx_status AS ENUM ('pending', 'confirmed', 'failed');

CREATE TYPE chain_type AS ENUM ('solana', 'base', 'polygon', 'internal');

CREATE TYPE token_type AS ENUM ('USDC', 'SOL', 'ETH', 'MATIC');

CREATE TYPE escrow_status AS ENUM ('held', 'released', 'refunded');

CREATE TYPE escrow_reason AS ENUM ('purchase', 'bid', 'auction');

-- ============================================================
-- WALLETS
-- ============================================================

CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,  -- FK to auth.users; agents also have wallets
  owner_type wallet_owner_type NOT NULL DEFAULT 'user',
  balance decimal(18,8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  held_balance decimal(18,8) NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  total_earned decimal(18,8) NOT NULL DEFAULT 0,
  total_spent decimal(18,8) NOT NULL DEFAULT 0,
  primary_chain chain_type DEFAULT 'solana',
  deposit_address_solana text,
  deposit_address_evm text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallets
  ADD CONSTRAINT wallets_owner_unique UNIQUE (owner_id, owner_type);

CREATE INDEX idx_wallets_owner_id ON wallets (owner_id);
CREATE INDEX idx_wallets_owner_type ON wallets (owner_type);
CREATE INDEX idx_wallets_is_active ON wallets (is_active) WHERE is_active = true;

-- ============================================================
-- WALLET TRANSACTIONS (Immutable Ledger)
-- ============================================================

CREATE TABLE wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  type wallet_tx_type NOT NULL,
  amount decimal(18,8) NOT NULL CHECK (amount > 0),
  fee decimal(18,8) DEFAULT 0,
  net_amount decimal(18,8) NOT NULL,  -- amount - fee
  reference_type text,  -- 'order', 'auction', 'api_call', 'listing'
  reference_id uuid,
  chain chain_type DEFAULT 'internal',
  tx_hash text,  -- blockchain transaction hash
  token token_type DEFAULT 'USDC',
  status wallet_tx_status DEFAULT 'pending',
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- No updated_at: this table is append-only

CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions (wallet_id);
CREATE INDEX idx_wallet_tx_status ON wallet_transactions (status);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions (created_at DESC);
CREATE INDEX idx_wallet_tx_reference ON wallet_transactions (reference_type, reference_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions (type);
CREATE INDEX idx_wallet_tx_chain ON wallet_transactions (chain) WHERE chain <> 'internal';

-- ============================================================
-- ESCROW HOLDS
-- ============================================================

CREATE TABLE escrow_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  amount decimal(18,8) NOT NULL CHECK (amount > 0),
  reason escrow_reason NOT NULL,
  reference_type text NOT NULL,  -- 'order', 'auction', 'bid'
  reference_id uuid NOT NULL,
  status escrow_status DEFAULT 'held',
  held_at timestamptz DEFAULT now(),
  released_at timestamptz,
  released_to_wallet_id uuid REFERENCES wallets(id),
  platform_fee_amount decimal(18,8) DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_escrow_reference ON escrow_holds (reference_type, reference_id);
CREATE INDEX idx_escrow_wallet ON escrow_holds (wallet_id);
CREATE INDEX idx_escrow_status ON escrow_holds (status);
CREATE INDEX idx_escrow_held_active ON escrow_holds (wallet_id, status) WHERE status = 'held';

-- ============================================================
-- PLATFORM FEE TIERS
-- ============================================================

CREATE TABLE platform_fee_tiers (
  id serial PRIMARY KEY,
  min_lifetime_sales decimal(18,2) NOT NULL,
  max_lifetime_sales decimal(18,2),  -- NULL = unlimited
  fee_percentage decimal(5,2) NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- API ENDPOINT PRICING (Phase E bot paywall foundation)
-- ============================================================

CREATE TABLE api_endpoint_pricing (
  id serial PRIMARY KEY,
  path_pattern text NOT NULL,  -- regex, e.g. '^/api/models/[^/]+$'
  method text DEFAULT 'GET',
  price_per_call decimal(10,6) NOT NULL DEFAULT 0,
  is_free_for_humans boolean DEFAULT true,
  rate_limit_free integer DEFAULT 10,   -- per minute
  rate_limit_paid integer DEFAULT 300,  -- per minute
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- wallets ---------------------------------------------------
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
  ON wallets FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Service role manages wallets"
  ON wallets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- wallet_transactions (append-only: no UPDATE/DELETE policies) --
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions"
  ON wallet_transactions FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages wallet transactions"
  ON wallet_transactions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- escrow_holds (managed by functions only) ------------------
ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own escrow holds"
  ON escrow_holds FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages escrow holds"
  ON escrow_holds FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- platform_fee_tiers ----------------------------------------
ALTER TABLE platform_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fee tiers are viewable by everyone"
  ON platform_fee_tiers FOR SELECT
  USING (true);

CREATE POLICY "Service role manages fee tiers"
  ON platform_fee_tiers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- api_endpoint_pricing --------------------------------------
ALTER TABLE api_endpoint_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "API pricing is viewable by everyone"
  ON api_endpoint_pricing FOR SELECT
  USING (true);

CREATE POLICY "Service role manages API pricing"
  ON api_endpoint_pricing FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SEED: Platform Fee Tiers
-- ============================================================

INSERT INTO platform_fee_tiers (min_lifetime_sales, max_lifetime_sales, fee_percentage) VALUES
  (0,       999.99,  10.0),   -- 10% for first $1K
  (1000,    9999.99,  5.0),   -- 5% for $1K-$10K
  (10000,   NULL,     2.5);   -- 2.5% for $10K+

-- ============================================================
-- SEED: API Endpoint Pricing
-- ============================================================

INSERT INTO api_endpoint_pricing (path_pattern, method, price_per_call, is_free_for_humans, rate_limit_free, rate_limit_paid, description) VALUES
  ('^/api/models$',           'GET',  0.000000, true, 10, 300, 'List models'),
  ('^/api/models/[^/]+$',    'GET',  0.001000, true, 10, 300, 'Get model by slug'),
  ('^/api/rankings$',         'GET',  0.001000, true, 10, 300, 'Get rankings'),
  ('^/api/benchmarks',        'GET',  0.002000, true, 10, 300, 'Get benchmarks'),
  ('^/api/mcp$',              'POST', 0.005000, true,  5, 100, 'MCP tool call'),
  ('^/api/search',            'GET',  0.001000, true, 10, 300, 'Search models');

-- ============================================================
-- TRIGGER: wallets updated_at
-- ============================================================

CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HELPER FUNCTIONS: Atomic Wallet Operations
-- ============================================================

-- ----- debit_wallet ----------------------------------------
CREATE OR REPLACE FUNCTION debit_wallet(
  p_wallet_id uuid,
  p_amount decimal,
  p_tx_type wallet_tx_type,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id uuid;
  v_balance decimal;
BEGIN
  -- Lock the wallet row for atomic update
  SELECT balance INTO v_balance
    FROM wallets
   WHERE id = p_wallet_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_balance, p_amount;
  END IF;

  -- Deduct balance
  UPDATE wallets
     SET balance     = balance - p_amount,
         total_spent = total_spent + p_amount,
         updated_at  = now()
   WHERE id = p_wallet_id;

  -- Immutable ledger entry
  INSERT INTO wallet_transactions
    (wallet_id, type, amount, fee, net_amount, reference_type, reference_id, description, status)
  VALUES
    (p_wallet_id, p_tx_type, p_amount, 0, p_amount, p_reference_type, p_reference_id, p_description, 'confirmed')
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ----- credit_wallet ---------------------------------------
CREATE OR REPLACE FUNCTION credit_wallet(
  p_wallet_id uuid,
  p_amount decimal,
  p_tx_type wallet_tx_type,
  p_chain chain_type DEFAULT 'internal',
  p_tx_hash text DEFAULT NULL,
  p_token token_type DEFAULT 'USDC',
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id uuid;
  v_wallet_exists boolean;
BEGIN
  -- Lock the wallet row for atomic update
  SELECT true INTO v_wallet_exists
    FROM wallets
   WHERE id = p_wallet_id
   FOR UPDATE;

  IF v_wallet_exists IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  -- Credit balance
  UPDATE wallets
     SET balance      = balance + p_amount,
         total_earned = total_earned + p_amount,
         updated_at   = now()
   WHERE id = p_wallet_id;

  -- Immutable ledger entry
  INSERT INTO wallet_transactions
    (wallet_id, type, amount, fee, net_amount, chain, tx_hash, token,
     reference_type, reference_id, description, status)
  VALUES
    (p_wallet_id, p_tx_type, p_amount, 0, p_amount, p_chain, p_tx_hash, p_token,
     p_reference_type, p_reference_id, p_description, 'confirmed')
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ----- hold_escrow -----------------------------------------
CREATE OR REPLACE FUNCTION hold_escrow(
  p_wallet_id uuid,
  p_amount decimal,
  p_reason escrow_reason,
  p_reference_type text,
  p_reference_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow_id uuid;
  v_balance decimal;
  v_tx_type wallet_tx_type;
BEGIN
  -- Lock the wallet row
  SELECT balance INTO v_balance
    FROM wallets
   WHERE id = p_wallet_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for escrow: have %, need %', v_balance, p_amount;
  END IF;

  -- Choose the right transaction type
  IF p_reason = 'bid' THEN
    v_tx_type := 'bid_hold';
  ELSE
    v_tx_type := 'escrow_hold';
  END IF;

  -- Move funds: balance -> held_balance
  UPDATE wallets
     SET balance      = balance - p_amount,
         held_balance = held_balance + p_amount,
         updated_at   = now()
   WHERE id = p_wallet_id;

  -- Create escrow record
  INSERT INTO escrow_holds
    (wallet_id, amount, reason, reference_type, reference_id, status, held_at)
  VALUES
    (p_wallet_id, p_amount, p_reason, p_reference_type, p_reference_id, 'held', now())
  RETURNING id INTO v_escrow_id;

  -- Immutable ledger entry
  INSERT INTO wallet_transactions
    (wallet_id, type, amount, fee, net_amount, reference_type, reference_id,
     description, status)
  VALUES
    (p_wallet_id, v_tx_type, p_amount, 0, p_amount, p_reference_type, p_reference_id,
     'Escrow hold: ' || p_reason::text, 'confirmed');

  RETURN v_escrow_id;
END;
$$;

-- ----- release_escrow --------------------------------------
CREATE OR REPLACE FUNCTION release_escrow(
  p_escrow_id uuid,
  p_to_wallet_id uuid,
  p_platform_fee decimal DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow escrow_holds%ROWTYPE;
  v_net_amount decimal;
  v_buyer_wallet_exists boolean;
  v_seller_wallet_exists boolean;
BEGIN
  -- Fetch and lock the escrow row
  SELECT * INTO v_escrow
    FROM escrow_holds
   WHERE id = p_escrow_id
   FOR UPDATE;

  IF v_escrow.id IS NULL THEN
    RAISE EXCEPTION 'Escrow hold not found: %', p_escrow_id;
  END IF;

  IF v_escrow.status <> 'held' THEN
    RAISE EXCEPTION 'Escrow is not in held status: current status = %', v_escrow.status;
  END IF;

  v_net_amount := v_escrow.amount - p_platform_fee;

  IF v_net_amount < 0 THEN
    RAISE EXCEPTION 'Platform fee (%) exceeds escrow amount (%)', p_platform_fee, v_escrow.amount;
  END IF;

  -- Lock buyer wallet (the one that originally held the escrow)
  SELECT true INTO v_buyer_wallet_exists
    FROM wallets
   WHERE id = v_escrow.wallet_id
   FOR UPDATE;

  IF v_buyer_wallet_exists IS NULL THEN
    RAISE EXCEPTION 'Buyer wallet not found: %', v_escrow.wallet_id;
  END IF;

  -- Lock seller/recipient wallet
  SELECT true INTO v_seller_wallet_exists
    FROM wallets
   WHERE id = p_to_wallet_id
   FOR UPDATE;

  IF v_seller_wallet_exists IS NULL THEN
    RAISE EXCEPTION 'Seller wallet not found: %', p_to_wallet_id;
  END IF;

  -- Deduct from buyer's held_balance
  UPDATE wallets
     SET held_balance = held_balance - v_escrow.amount,
         updated_at   = now()
   WHERE id = v_escrow.wallet_id;

  -- Credit seller wallet with net amount
  UPDATE wallets
     SET balance      = balance + v_net_amount,
         total_earned = total_earned + v_net_amount,
         updated_at   = now()
   WHERE id = p_to_wallet_id;

  -- Update escrow record
  UPDATE escrow_holds
     SET status              = 'released',
         released_at         = now(),
         released_to_wallet_id = p_to_wallet_id,
         platform_fee_amount = p_platform_fee
   WHERE id = p_escrow_id;

  -- Ledger: escrow_release for seller
  INSERT INTO wallet_transactions
    (wallet_id, type, amount, fee, net_amount, reference_type, reference_id,
     description, status)
  VALUES
    (p_to_wallet_id, 'escrow_release', v_escrow.amount, p_platform_fee, v_net_amount,
     v_escrow.reference_type, v_escrow.reference_id,
     'Escrow released: ' || v_escrow.reason::text, 'confirmed');

  -- Ledger: platform_fee on buyer's record (if fee > 0)
  IF p_platform_fee > 0 THEN
    INSERT INTO wallet_transactions
      (wallet_id, type, amount, fee, net_amount, reference_type, reference_id,
       description, status)
    VALUES
      (v_escrow.wallet_id, 'platform_fee', p_platform_fee, 0, p_platform_fee,
       v_escrow.reference_type, v_escrow.reference_id,
       'Platform fee: ' || p_platform_fee::text || ' on ' || v_escrow.reason::text,
       'confirmed');
  END IF;
END;
$$;

-- ----- refund_escrow ---------------------------------------
CREATE OR REPLACE FUNCTION refund_escrow(
  p_escrow_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow escrow_holds%ROWTYPE;
  v_wallet_exists boolean;
  v_tx_type wallet_tx_type;
BEGIN
  -- Fetch and lock the escrow row
  SELECT * INTO v_escrow
    FROM escrow_holds
   WHERE id = p_escrow_id
   FOR UPDATE;

  IF v_escrow.id IS NULL THEN
    RAISE EXCEPTION 'Escrow hold not found: %', p_escrow_id;
  END IF;

  IF v_escrow.status <> 'held' THEN
    RAISE EXCEPTION 'Escrow is not in held status: current status = %', v_escrow.status;
  END IF;

  -- Lock the wallet
  SELECT true INTO v_wallet_exists
    FROM wallets
   WHERE id = v_escrow.wallet_id
   FOR UPDATE;

  IF v_wallet_exists IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', v_escrow.wallet_id;
  END IF;

  -- Move funds back: held_balance -> balance
  UPDATE wallets
     SET held_balance = held_balance - v_escrow.amount,
         balance      = balance + v_escrow.amount,
         updated_at   = now()
   WHERE id = v_escrow.wallet_id;

  -- Update escrow record
  UPDATE escrow_holds
     SET status      = 'refunded',
         released_at = now()
   WHERE id = p_escrow_id;

  -- Choose the right transaction type for the refund ledger entry
  IF v_escrow.reason = 'bid' THEN
    v_tx_type := 'bid_release';
  ELSE
    v_tx_type := 'refund';
  END IF;

  -- Immutable ledger entry
  INSERT INTO wallet_transactions
    (wallet_id, type, amount, fee, net_amount, reference_type, reference_id,
     description, status)
  VALUES
    (v_escrow.wallet_id, v_tx_type, v_escrow.amount, 0, v_escrow.amount,
     v_escrow.reference_type, v_escrow.reference_id,
     'Escrow refunded: ' || v_escrow.reason::text, 'confirmed');
END;
$$;

-- ----- get_platform_fee_rate -------------------------------
CREATE OR REPLACE FUNCTION get_platform_fee_rate(
  p_wallet_id uuid
)
RETURNS decimal
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_earned decimal;
  v_fee_rate decimal;
BEGIN
  SELECT total_earned INTO v_total_earned
    FROM wallets
   WHERE id = p_wallet_id;

  IF v_total_earned IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  SELECT fee_percentage INTO v_fee_rate
    FROM platform_fee_tiers
   WHERE v_total_earned >= min_lifetime_sales
     AND (max_lifetime_sales IS NULL OR v_total_earned <= max_lifetime_sales)
   ORDER BY min_lifetime_sales DESC
   LIMIT 1;

  -- Fallback to highest tier if no exact match (should not happen with proper seed data)
  IF v_fee_rate IS NULL THEN
    SELECT fee_percentage INTO v_fee_rate
      FROM platform_fee_tiers
     ORDER BY min_lifetime_sales DESC
     LIMIT 1;
  END IF;

  RETURN COALESCE(v_fee_rate, 10.0);
END;
$$;

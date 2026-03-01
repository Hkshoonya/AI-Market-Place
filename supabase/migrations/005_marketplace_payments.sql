-- Marketplace Payments Integration
-- Adds delivery_data to orders, creates helper functions

-- Add delivery_data JSONB column to marketplace_orders
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS delivery_data JSONB DEFAULT NULL;

-- Add payment_method column to track how the order was paid
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;

-- Add escrow_hold_id to track the associated escrow
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS escrow_hold_id UUID DEFAULT NULL;

-- Index for orders with active escrows
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_escrow
  ON marketplace_orders (escrow_hold_id) WHERE escrow_hold_id IS NOT NULL;

-- Function to atomically increment seller's total_sales
CREATE OR REPLACE FUNCTION increment_seller_sales(
  p_seller_id UUID,
  p_amount DECIMAL DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET total_sales = COALESCE(total_sales, 0) + p_amount,
      updated_at = now()
  WHERE id = p_seller_id;
END;
$$;

-- Allow guest purchases: make buyer_id nullable and add guest fields
ALTER TABLE marketplace_orders ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add a check: either buyer_id OR guest_email must be present
ALTER TABLE marketplace_orders ADD CONSTRAINT chk_buyer_or_guest
  CHECK (buyer_id IS NOT NULL OR guest_email IS NOT NULL);

-- Index for guest lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_guest_email ON marketplace_orders(guest_email) WHERE guest_email IS NOT NULL;

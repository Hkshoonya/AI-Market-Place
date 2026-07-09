DROP INDEX IF EXISTS idx_marketplace_orders_active_buyer_listing;

CREATE UNIQUE INDEX idx_marketplace_orders_active_buyer_listing
  ON marketplace_orders (buyer_id, listing_id)
  WHERE buyer_id IS NOT NULL
    AND status IN ('pending', 'approved', 'completed');

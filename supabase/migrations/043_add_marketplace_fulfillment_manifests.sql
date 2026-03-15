-- Add protocol-native marketplace fulfillment manifests.
-- preview_manifest is safe public listing metadata.
-- fulfillment_manifest_snapshot is the immutable purchased contract per order.

ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS preview_manifest JSONB;

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS fulfillment_manifest_snapshot JSONB;

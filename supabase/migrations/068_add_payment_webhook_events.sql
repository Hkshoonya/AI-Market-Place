CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NULL,
  event_type TEXT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('processed', 'ignored', 'failed')),
  wallet_id UUID NULL REFERENCES wallets(id) ON DELETE SET NULL,
  reference_id TEXT NULL,
  amount NUMERIC(18,6) NULL,
  currency TEXT NULL,
  duplicate BOOLEAN NOT NULL DEFAULT false,
  livemode BOOLEAN NULL,
  error_message TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_created
  ON payment_webhook_events (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_status_created
  ON payment_webhook_events (provider, delivery_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id
  ON payment_webhook_events (event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view payment webhook events" ON payment_webhook_events;
CREATE POLICY "Admins can view payment webhook events"
  ON payment_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role manages payment webhook events" ON payment_webhook_events;
CREATE POLICY "Service role manages payment webhook events"
  ON payment_webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

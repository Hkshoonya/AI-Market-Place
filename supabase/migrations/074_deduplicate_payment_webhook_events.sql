WITH ranked_events AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY provider, event_id
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM payment_webhook_events
  WHERE event_id IS NOT NULL
)
DELETE FROM payment_webhook_events AS events
USING ranked_events
WHERE events.id = ranked_events.id
  AND ranked_events.duplicate_rank > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'payment_webhook_events'::regclass
      AND conname = 'payment_webhook_events_provider_event_id_key'
  ) THEN
    ALTER TABLE payment_webhook_events
      ADD CONSTRAINT payment_webhook_events_provider_event_id_key
      UNIQUE (provider, event_id);
  END IF;
END
$$;

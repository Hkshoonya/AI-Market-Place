-- Promote provider launch-signal ingestion onto the fastest scheduled lane.
-- This improves freshness for provider blogs and X announcement feeds without
-- requiring new adapter logic.

UPDATE data_sources
SET
  tier = 1,
  sync_interval_hours = 2,
  priority = CASE
    WHEN slug = 'provider-news' THEN 55
    WHEN slug = 'x-announcements' THEN 60
    ELSE priority
  END
WHERE slug IN ('provider-news', 'x-announcements');

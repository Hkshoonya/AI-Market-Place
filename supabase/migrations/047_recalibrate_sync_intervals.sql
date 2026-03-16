-- Recalibrate source freshness so public pages stop feeling stale even when
-- cron is running normally. The runtime scheduler is moving to:
-- tier 1 = every 2h
-- tier 2 = every 4h
-- tier 3 = every 8h
-- tier 4 = every 24h

UPDATE data_sources
SET sync_interval_hours = 2
WHERE tier = 1
  AND is_enabled = true;

UPDATE data_sources
SET sync_interval_hours = 4
WHERE tier = 2
  AND is_enabled = true;

UPDATE data_sources
SET sync_interval_hours = 8
WHERE tier = 3
  AND is_enabled = true;

UPDATE data_sources
SET sync_interval_hours = 24
WHERE tier = 4
  AND is_enabled = true;

UPDATE pipeline_health ph
SET expected_interval_hours = ds.sync_interval_hours
FROM data_sources ds
WHERE ph.source_slug = ds.slug;

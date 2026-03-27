-- Increase freshness for benchmark sources that back public model pages while
-- retiring the dead SEAL feed until a supported upstream replacement exists.

UPDATE data_sources
SET tier = 3,
    sync_interval_hours = 8,
    updated_at = now()
WHERE slug IN (
  'livebench',
  'livecodebench',
  'swe-bench',
  'arena-hard-auto',
  'bigcode-leaderboard',
  'open-vlm-leaderboard'
);

UPDATE data_sources
SET is_enabled = false,
    quarantined_at = COALESCE(quarantined_at, now()),
    quarantine_reason = 'Retired: upstream SEAL dataset endpoint no longer serves a reliable public leaderboard feed',
    last_error_message = COALESCE(
      last_error_message,
      'Retired: upstream SEAL dataset endpoint no longer serves a reliable public leaderboard feed'
    ),
    updated_at = now()
WHERE slug = 'seal-leaderboard';

UPDATE pipeline_health ph
SET expected_interval_hours = ds.sync_interval_hours
FROM data_sources ds
WHERE ph.source_slug = ds.slug
  AND ds.slug IN (
    'livebench',
    'livecodebench',
    'swe-bench',
    'arena-hard-auto',
    'bigcode-leaderboard',
    'open-vlm-leaderboard'
  );

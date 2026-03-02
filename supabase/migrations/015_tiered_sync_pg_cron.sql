-- Tiered sync schedules via pg_cron
-- T0 (2h): provider model catalogs
-- T1 (6h): HF stats, benchmarks, ELO
-- T2 (24h): GitHub, news, pricing
-- T3 (weekly): leaderboard crawls

UPDATE data_sources SET tier = 0, sync_interval_hours = 2
WHERE adapter_type IN ('openai-models', 'anthropic-models', 'google-models', 'openrouter-models');

UPDATE data_sources SET tier = 1, sync_interval_hours = 6
WHERE adapter_type IN ('huggingface', 'open-llm-leaderboard', 'chatbot-arena');

UPDATE data_sources SET tier = 2, sync_interval_hours = 24
WHERE adapter_type IN ('github-stars', 'provider-news', 'provider-pricing', 'x-announcements');

UPDATE data_sources SET tier = 3, sync_interval_hours = 168
WHERE adapter_type IN ('livebench', 'seal-leaderboard', 'bigcode-leaderboard', 'open-vlm-leaderboard');

-- Update pipeline_health expected intervals
UPDATE pipeline_health SET expected_interval_hours = ds.sync_interval_hours
FROM data_sources ds WHERE pipeline_health.source_slug = ds.slug;

-- NOTE: pg_cron schedules configured in Supabase dashboard:
-- SELECT cron.schedule('sync-t0', '0 */2 * * *', $$SELECT net.http_get(...)$$);
-- SELECT cron.schedule('sync-t1', '0 */6 * * *', $$SELECT net.http_get(...)$$);
-- SELECT cron.schedule('sync-t2', '0 4 * * *',   $$SELECT net.http_get(...)$$);
-- SELECT cron.schedule('sync-t3', '0 2 * * 0',   $$SELECT net.http_get(...)$$);

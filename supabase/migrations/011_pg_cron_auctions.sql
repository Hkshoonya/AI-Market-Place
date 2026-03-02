-- Move auctions cron from Vercel (288 invocations/day) to pg_cron (runs in-database, free)
-- Requires: pg_cron and pg_net extensions

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- The auction cron job calls the API endpoint every 5 minutes.
-- IMPORTANT: Update the URL and CRON_SECRET below before deploying.
-- Replace 'YOUR_DEPLOYED_URL' with your actual Vercel/production URL.
-- Replace 'YOUR_CRON_SECRET' with your actual CRON_SECRET value.
--
-- To activate manually after deployment, run:
--
-- SELECT cron.schedule(
--   'process-auctions',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://your-site.vercel.app/api/cron/auctions',
--     headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- To check job status:   SELECT * FROM cron.job;
-- To view run history:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- To remove the job:     SELECT cron.unschedule('process-auctions');

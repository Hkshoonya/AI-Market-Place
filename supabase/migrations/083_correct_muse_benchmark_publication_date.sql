-- Meta published the Muse Spark 1.1 announcement on July 9. The first
-- auto-discovery run used its crawl time because the page omits a parseable
-- publication date.
UPDATE model_news
SET published_at = TIMESTAMPTZ '2026-07-09 00:00:00+00'
WHERE source = 'provider-benchmarks'
  AND source_id = 'provider-benchmarks-auto-web-meta-muse-spark-1-1';

\set ON_ERROR_STOP on
-- Run only in an empty, disposable PostgreSQL 17 database, never production.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.model_news (
  id uuid PRIMARY KEY, category text, related_model_ids uuid[], title text
);
ALTER TABLE public.model_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read model_news" ON public.model_news FOR SELECT USING (true);
CREATE POLICY "Service role can manage model_news" ON public.model_news FOR ALL USING (true);
GRANT ALL ON public.model_news TO anon, authenticated;
CREATE TABLE public.models (
  id uuid PRIMARY KEY, slug text, name text, provider text, category text, status text,
  description text, short_description text, architecture text, parameter_count bigint,
  context_window integer, release_date date, hf_model_id text, hf_downloads bigint,
  hf_likes integer, hf_trending_score numeric, website_url text, license text, license_name text,
  is_open_weights boolean, is_api_available boolean, overall_rank integer, quality_score numeric,
  capability_score numeric, popularity_score numeric, adoption_score numeric,
  economic_footprint_score numeric, market_cap_estimate numeric,
  private_fixture_field text
);
GRANT SELECT ON public.models TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_news TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY visible_models ON public.models FOR SELECT USING (name <> 'Restricted');
CREATE INDEX idx_models_status_rank_id ON public.models(status, overall_rank, id);
INSERT INTO public.models(id, name, status, overall_rank, description, private_fixture_field)
SELECT md5(i::text)::uuid, 'Model ' || i, 'active',
  CASE WHEN i % 10 <> 0 THEN i / 3 END, repeat('description ', 80), 'not exposed'
FROM generate_series(1, 10025) i;
INSERT INTO public.models(id, name, status, overall_rank)
VALUES ('ffffffff-ffff-ffff-ffff-fffffffffff1', 'Restricted', 'active', 1),
       ('ffffffff-ffff-ffff-ffff-fffffffffff2', 'Old model', 'archived', 1);
INSERT INTO public.model_news(id, category, related_model_ids)
SELECT '11111111-1111-1111-1111-111111111111', 'benchmark', array_agg(md5(i::text)::uuid)
FROM generate_series(1, 3500) i;

\ir ../migrations/103_harden_model_news_access.sql
\ir ../migrations/104_benchmark_evidence_projection.sql
\ir ../migrations/105_ranked_directory_page.sql

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  original_tid tid;
  model_a uuid := md5('1')::uuid;
  model_b uuid := md5('2')::uuid;
  fresh_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  test_news_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  IF cardinality(public.get_benchmark_evidence_model_ids()) <> 3500 THEN
    RAISE EXCEPTION 'Backfill lost IDs or hit a response limit';
  END IF;
  INSERT INTO public.model_news VALUES (test_news_id, 'general', ARRAY[fresh_id], 'test');
  IF EXISTS (SELECT FROM public.benchmark_evidence_links WHERE benchmark_evidence_links.news_id = test_news_id) THEN
    RAISE EXCEPTION 'Non-benchmark news entered projection';
  END IF;
  UPDATE public.model_news SET category = 'benchmark', related_model_ids = ARRAY[model_a, fresh_id, fresh_id, NULL] WHERE id = test_news_id;
  IF cardinality(public.get_benchmark_evidence_model_ids()) <> 3501 THEN
    RAISE EXCEPTION 'Reclassification/deduplication/null handling failed';
  END IF;
  SELECT ctid INTO original_tid FROM public.benchmark_evidence_links links WHERE links.news_id = test_news_id;
  UPDATE public.model_news SET title = 'changed', related_model_ids = related_model_ids WHERE id = test_news_id;
  IF original_tid IS DISTINCT FROM (SELECT ctid FROM public.benchmark_evidence_links links WHERE links.news_id = test_news_id) THEN
    RAISE EXCEPTION 'Unchanged links caused an unnecessary write';
  END IF;
  UPDATE public.model_news SET related_model_ids = ARRAY[model_b] WHERE id = test_news_id;
  IF fresh_id = ANY(public.get_benchmark_evidence_model_ids()) THEN
    RAISE EXCEPTION 'Removed evidence stayed in summary';
  END IF;
  UPDATE public.model_news SET related_model_ids = '{}'::uuid[] WHERE id = test_news_id;
  IF EXISTS (SELECT FROM public.benchmark_evidence_links links WHERE links.news_id = test_news_id) THEN
    RAISE EXCEPTION 'Empty array was not removed';
  END IF;
  UPDATE public.model_news SET related_model_ids = ARRAY[fresh_id] WHERE id = test_news_id;
  UPDATE public.model_news SET related_model_ids = NULL WHERE id = test_news_id;
  IF fresh_id = ANY(public.get_benchmark_evidence_model_ids()) THEN RAISE EXCEPTION 'NULL cleanup failed'; END IF;
  UPDATE public.model_news SET related_model_ids = ARRAY[fresh_id] WHERE id = test_news_id;
  UPDATE public.model_news SET category = 'general' WHERE id = test_news_id;
  IF fresh_id = ANY(public.get_benchmark_evidence_model_ids()) THEN RAISE EXCEPTION 'Category cleanup failed'; END IF;
  UPDATE public.model_news SET category = 'benchmark' WHERE id = test_news_id;
  UPDATE public.model_news SET id = '33333333-3333-3333-3333-333333333333' WHERE id = test_news_id;
  DELETE FROM public.model_news WHERE id = '33333333-3333-3333-3333-333333333333';
  IF cardinality(public.get_benchmark_evidence_model_ids()) <> 3500 THEN RAISE EXCEPTION 'Cascade/shared evidence failed'; END IF;
  BEGIN
    INSERT INTO public.model_news VALUES (test_news_id, 'benchmark', ARRAY[fresh_id], 'rollback');
    RAISE EXCEPTION 'rollback fixture' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF fresh_id = ANY(public.get_benchmark_evidence_model_ids()) THEN RAISE EXCEPTION 'Projection escaped rollback'; END IF;
  IF has_table_privilege('service_role', 'public.benchmark_evidence_links', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Service client can mutate the derived projection directly';
  END IF;
END;
$$;
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL plan_cache_mode = force_generic_plan;
SET LOCAL work_mem = '2MB';
DO $$
DECLARE
  page jsonb;
  expected jsonb;
  offset_value integer;
BEGIN
  FOR offset_value IN SELECT generate_series(0, 9500, 500) LOOP
    page := public.get_ranked_model_directory_page(offset_value);
    SELECT jsonb_agg(id ORDER BY overall_rank ASC NULLS LAST, id) INTO expected
    FROM (SELECT id, overall_rank FROM public.models WHERE status = 'active'
      ORDER BY overall_rank ASC NULLS LAST, id LIMIT 500 OFFSET offset_value) original;
    IF (SELECT jsonb_agg(item->'id' ORDER BY ordinal) FROM jsonb_array_elements(page->'data') WITH ORDINALITY AS rows(item, ordinal))
      IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Ordering or RLS mismatch at %', offset_value; END IF;
    IF offset_value = 0 AND (page->>'count')::integer <> 10025 THEN RAISE EXCEPTION 'Count lost rows or bypassed RLS'; END IF;
    IF offset_value > 0 AND page->'count' <> 'null'::jsonb THEN RAISE EXCEPTION 'Count repeated on a later page'; END IF;
    IF page->'data'->0 ? 'private_fixture_field' THEN RAISE EXCEPTION 'Unselected field leaked'; END IF;
  END LOOP;
  FOREACH offset_value IN ARRAY ARRAY[-1, 1, 10000, NULL] LOOP
    BEGIN
      PERFORM public.get_ranked_model_directory_page(offset_value);
      RAISE EXCEPTION 'Invalid offset accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.get_benchmark_evidence_model_ids();
    RAISE EXCEPTION 'Private summary is callable by anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.benchmark_evidence_links;
    RAISE EXCEPTION 'Private projection is readable by anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.model_news SET title = title WHERE false;
    RAISE EXCEPTION 'Anonymous news writes remain permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM 1 FROM public.model_news;
END;
$$;
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.benchmark_evidence_links', 'SELECT') OR
     has_table_privilege('authenticated', 'public.model_news', 'INSERT,UPDATE,DELETE,TRUNCATE') OR
     has_function_privilege('authenticated', 'public.get_benchmark_evidence_model_ids()', 'EXECUTE') OR
     has_function_privilege('service_role', 'public.sync_benchmark_evidence_links()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private grants are too broad';
  END IF;
END $$;
DELETE FROM public.models;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF public.get_ranked_model_directory_page(0) <> '{"data":[],"count":0}'::jsonb THEN
    RAISE EXCEPTION 'Empty catalogue failed';
  END IF;
END $$;
ROLLBACK;
SELECT 'disk IO regression checks passed' AS result;

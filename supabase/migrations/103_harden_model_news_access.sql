BEGIN;
SET LOCAL lock_timeout = '2s';
-- Production drift: a policy named "Service role" was FOR ALL TO PUBLIC USING
-- (true). RLS labels do not restrict roles. News writes are server/agent-only.
DROP POLICY IF EXISTS "Service role can manage model_news" ON public.model_news;
CREATE POLICY "Service role can manage model_news" ON public.model_news
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.model_news FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_news TO service_role;
COMMIT;

-- Durable server-generated API response cache for expensive public endpoints.

CREATE TABLE IF NOT EXISTS public.api_response_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_api_response_cache_expires_at
  ON public.api_response_cache (expires_at);

ALTER TABLE public.api_response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read fresh API response cache entries"
  ON public.api_response_cache;

CREATE POLICY "Public can read fresh API response cache entries"
  ON public.api_response_cache
  FOR SELECT
  USING (expires_at > NOW());

GRANT SELECT ON public.api_response_cache TO anon, authenticated;

-- Minimal supporting schema for real Auth/PostgREST billing integration tests.
-- Billing migrations themselves are applied unchanged by the test harness.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'sub', '')::UUID;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims', true)::JSONB->>'role';
$$;
CREATE FUNCTION public.update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT, display_name TEXT, avatar_url TEXT, bio TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE, is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  is_seller BOOLEAN NOT NULL DEFAULT FALSE, seller_verified BOOLEAN NOT NULL DEFAULT FALSE,
  seller_bio TEXT, seller_website TEXT, seller_rating NUMERIC, total_sales INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT, key_prefix TEXT, key_hash TEXT UNIQUE, scopes TEXT[], rate_limit_per_minute INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, expires_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_keys ON public.api_keys FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TABLE public.api_endpoint_pricing (
  id SERIAL PRIMARY KEY, path_pattern TEXT, method TEXT, price_per_call NUMERIC,
  is_free_for_humans BOOLEAN, rate_limit_free INTEGER, rate_limit_paid INTEGER,
  description TEXT, is_active BOOLEAN DEFAULT TRUE
);
CREATE TABLE public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT UNIQUE, name TEXT,
  provider TEXT, category TEXT DEFAULT 'llm', status TEXT DEFAULT 'active', balanced_rank INTEGER,
  description TEXT, short_description TEXT, release_date DATE, is_open_weights BOOLEAN DEFAULT FALSE
);
INSERT INTO public.models (slug, name, provider, balanced_rank)
  VALUES ('billing-test-model', 'Synthetic billing test record', 'Test fixture', 1);
CREATE TABLE public.wallets (owner_id UUID, owner_type TEXT, balance NUMERIC DEFAULT 0, held_balance NUMERIC DEFAULT 0);
GRANT SELECT ON public.models, public.profiles, public.api_endpoint_pricing, public.wallets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;

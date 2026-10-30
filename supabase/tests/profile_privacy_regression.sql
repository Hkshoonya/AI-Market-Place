\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, username text, display_name text, avatar_url text, bio text, title text,
  email text, saved_layout jsonb, preferences jsonb, bankroll numeric,
  is_admin boolean DEFAULT false, is_banned boolean DEFAULT false,
  is_seller boolean DEFAULT false, seller_verified boolean DEFAULT false,
  joined_at timestamptz, seller_bio text, seller_website text, seller_rating numeric,
  total_sales integer, created_at timestamptz, updated_at timestamptz
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY directory_read ON public.profiles FOR SELECT USING (true);
CREATE POLICY own_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY own_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT SELECT (email), UPDATE (is_admin) ON public.profiles TO authenticated;
INSERT INTO public.profiles (id, username, email) VALUES
  ('00000000-0000-4000-8000-000000000001', 'owner', 'owner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'other', 'other@example.test');
\ir ../migrations/112_protect_private_profile_columns.sql
\ir ../migrations/112_protect_private_profile_columns.sql
DO $$
DECLARE affected integer;
BEGIN
  SET LOCAL ROLE anon;
  PERFORM username FROM public.profiles;
  BEGIN PERFORM email FROM public.profiles; RAISE EXCEPTION 'Anonymous email disclosure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM saved_layout FROM public.profiles; RAISE EXCEPTION 'Anonymous layout disclosure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM email FROM public.profiles; RAISE EXCEPTION 'Authenticated email disclosure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.profiles SET display_name = 'Own profile' WHERE id = auth.uid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own profile edit broken'; END IF;
  UPDATE public.profiles SET display_name = 'Other profile' WHERE id <> auth.uid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-user update allowed'; END IF;
  BEGIN UPDATE public.profiles SET is_admin = true WHERE id = auth.uid(); RAISE EXCEPTION 'Self administrator escalation';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.profiles SET seller_verified = true WHERE id = auth.uid(); RAISE EXCEPTION 'Self verification escalation';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.profiles (id, is_admin) VALUES (gen_random_uuid(), true); RAISE EXCEPTION 'Privileged insert allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM email FROM public.profiles;
  RESET ROLE;
END;
$$;
SELECT 'Profile privacy, grants, tenant isolation and privilege protections passed' AS result;

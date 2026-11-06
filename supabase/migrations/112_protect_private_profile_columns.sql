-- RLS controls rows, not columns. Public directory grants must not include
-- account email, private layouts/preferences, or future sensitive columns.
BEGIN;
REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
DO $migration$
DECLARE columns_sql text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns_sql
    FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s) ON public.profiles FROM PUBLIC, anon, authenticated', columns_sql);
END;
$migration$;
GRANT SELECT (
  id, username, display_name, avatar_url, bio,
  is_admin, is_banned, is_seller, seller_verified,
  joined_at, seller_bio, seller_website, seller_rating, total_sales, created_at, updated_at
) ON public.profiles TO anon, authenticated;
-- Existing RLS still limits edits to the current user's row. Administrator and
-- seller-verification flags remain writable only through trusted server paths.
GRANT UPDATE (
  username, display_name, avatar_url, bio, title,
  is_seller, seller_bio, seller_website, preferences, saved_layout, updated_at
) ON public.profiles TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Auth should follow Supabase's normal confirmation flow now that SMTP is configured.
-- The custom auto-confirm trigger mutates auth.users during signup and can break Auth API user creation.
DROP TRIGGER IF EXISTS on_auth_user_confirm_email ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email();

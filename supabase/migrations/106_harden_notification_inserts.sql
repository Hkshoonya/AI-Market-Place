BEGIN;
SET LOCAL lock_timeout = '2s';
-- Contact, moderation and order-message handlers create notifications with the
-- admin client. Users may read/mark their own rows, but cannot forge system rows.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, TRUNCATE, REFERENCES, TRIGGER ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.notifications TO service_role;
COMMIT;

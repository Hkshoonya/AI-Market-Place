-- Lock down pipeline_health from direct PostgREST access.
-- The app reads and writes this table through server-side service-role clients.

ALTER TABLE public.pipeline_health ENABLE ROW LEVEL SECURITY;

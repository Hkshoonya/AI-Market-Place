CREATE TABLE public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_name TEXT NOT NULL,
  status TEXT DEFAULT 'running', started_at TIMESTAMPTZ DEFAULT NOW(), finished_at TIMESTAMPTZ,
  duration_ms INTEGER, result_summary JSONB, error_message TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id),
  title TEXT, message TEXT, link TEXT, type TEXT, is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notifications ON public.notifications FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON public.notifications TO authenticated;

update public.data_sources
set
  is_enabled = false,
  quarantined_at = timezone('utc', now()),
  quarantine_reason = 'Temporarily disabled after sustained upstream arXiv API 429 rate limiting'
where slug = 'arxiv';

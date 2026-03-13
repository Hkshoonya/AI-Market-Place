-- Durable, database-backed rate limiting for multi-instance deployments.

create table if not exists public.rate_limit_counters (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_rate_limit_counters_updated_at
  on public.rate_limit_counters (updated_at desc);

alter table public.rate_limit_counters enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_limit_counters'
      and policyname = 'service_role_manage_rate_limit_counters'
  ) then
    create policy service_role_manage_rate_limit_counters
      on public.rate_limit_counters
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  limit_count integer,
  remaining integer,
  reset integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_window_started_at timestamptz;
  v_request_count integer;
  v_window_expires_at timestamptz;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) = 0 then
    raise exception 'p_bucket_key is required';
  end if;

  if p_max_requests <= 0 then
    raise exception 'p_max_requests must be positive';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_bucket_key)::bigint);

  select window_started_at, request_count
  into v_window_started_at, v_request_count
  from public.rate_limit_counters
  where bucket_key = p_bucket_key;

  if not found or v_now >= v_window_started_at + (p_window_seconds * interval '1 second') then
    insert into public.rate_limit_counters (
      bucket_key,
      window_started_at,
      request_count,
      updated_at
    )
    values (
      p_bucket_key,
      v_now,
      1,
      v_now
    )
    on conflict (bucket_key) do update
      set window_started_at = excluded.window_started_at,
          request_count = excluded.request_count,
          updated_at = excluded.updated_at;

    return query
      select
        true,
        p_max_requests,
        greatest(p_max_requests - 1, 0),
        p_window_seconds;
    return;
  end if;

  v_window_expires_at := v_window_started_at + (p_window_seconds * interval '1 second');

  if v_request_count >= p_max_requests then
    return query
      select
        false,
        p_max_requests,
        0,
        greatest(1, ceil(extract(epoch from (v_window_expires_at - v_now)))::integer);
    return;
  end if;

  update public.rate_limit_counters
  set request_count = request_count + 1,
      updated_at = v_now
  where bucket_key = p_bucket_key
  returning request_count into v_request_count;

  return query
    select
      true,
      p_max_requests,
      greatest(p_max_requests - v_request_count, 0),
      greatest(1, ceil(extract(epoch from (v_window_expires_at - v_now)))::integer);
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
revoke all on function public.check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

create table if not exists public.security_rate_limits (
  rate_scope text not null,
  rate_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  blocked_until timestamptz,
  primary key (rate_scope, rate_key)
);

create index if not exists security_rate_limits_blocked_until_idx
on public.security_rate_limits (blocked_until);

alter table public.security_rate_limits enable row level security;

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  actor_user_id uuid,
  salon_id uuid,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'critical')),
  ip_address text,
  request_path text,
  target_type text,
  target_id text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists security_audit_logs_created_at_idx
on public.security_audit_logs (created_at desc);

create index if not exists security_audit_logs_event_type_idx
on public.security_audit_logs (event_type, created_at desc);

create index if not exists security_audit_logs_actor_user_id_idx
on public.security_audit_logs (actor_user_id, created_at desc);

create index if not exists security_audit_logs_salon_id_idx
on public.security_audit_logs (salon_id, created_at desc);

alter table public.security_audit_logs enable row level security;

create or replace function public.consume_security_rate_limit(
  rate_scope_input text,
  rate_key_input text,
  max_attempts_input integer,
  window_seconds_input integer,
  block_seconds_input integer default 0
)
returns table (
  allowed boolean,
  attempts integer,
  retry_after_seconds integer,
  blocked_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  window_anchor timestamptz := timezone('utc', now());
  effective_block_seconds integer := greatest(coalesce(block_seconds_input, 0), 0);
  existing_row public.security_rate_limits%rowtype;
  next_attempts integer := 0;
  next_blocked_until timestamptz := null;
begin
  if coalesce(length(trim(rate_scope_input)), 0) = 0 then
    raise exception 'rate_scope_required';
  end if;

  if coalesce(length(trim(rate_key_input)), 0) = 0 then
    raise exception 'rate_key_required';
  end if;

  if max_attempts_input is null or max_attempts_input < 1 then
    raise exception 'max_attempts_invalid';
  end if;

  if window_seconds_input is null or window_seconds_input < 1 then
    raise exception 'window_seconds_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(trim(rate_scope_input) || ':' || trim(rate_key_input), 0)
  );

  select *
  into existing_row
  from public.security_rate_limits
  where rate_scope = trim(rate_scope_input)
    and rate_key = trim(rate_key_input)
  for update;

  if found then
    if existing_row.blocked_until is not null and existing_row.blocked_until > now_utc then
      return query
      select
        false,
        existing_row.attempts,
        greatest(1, ceil(extract(epoch from existing_row.blocked_until - now_utc)))::integer,
        existing_row.blocked_until;
      return;
    end if;

    if existing_row.window_started_at + make_interval(secs => window_seconds_input) <= now_utc then
      window_anchor := now_utc;
      existing_row.attempts := 0;
      existing_row.blocked_until := null;
    else
      window_anchor := existing_row.window_started_at;
    end if;
  end if;

  next_attempts := coalesce(existing_row.attempts, 0) + 1;

  if next_attempts > max_attempts_input then
    next_blocked_until := now_utc + make_interval(
      secs => greatest(
        effective_block_seconds,
        window_seconds_input
      )
    );
  end if;

  insert into public.security_rate_limits (
    rate_scope,
    rate_key,
    attempts,
    window_started_at,
    updated_at,
    blocked_until
  )
  values (
    trim(rate_scope_input),
    trim(rate_key_input),
    next_attempts,
    window_anchor,
    now_utc,
    next_blocked_until
  )
  on conflict (rate_scope, rate_key)
  do update
  set
    attempts = excluded.attempts,
    window_started_at = excluded.window_started_at,
    updated_at = excluded.updated_at,
    blocked_until = excluded.blocked_until;

  return query
  select
    next_attempts <= max_attempts_input,
    next_attempts,
    case
      when next_blocked_until is null then 0
      else greatest(1, ceil(extract(epoch from next_blocked_until - now_utc)))::integer
    end,
    next_blocked_until;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, text, integer, integer, integer) from public;
grant execute on function public.consume_security_rate_limit(text, text, integer, integer, integer) to service_role;

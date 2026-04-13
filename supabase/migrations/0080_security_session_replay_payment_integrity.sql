alter table public.appointments
add column if not exists service_price_snapshot numeric(10, 2);

alter table public.appointments
drop constraint if exists appointments_service_price_snapshot_check;

alter table public.appointments
add constraint appointments_service_price_snapshot_check
check (
  service_price_snapshot is null
  or service_price_snapshot >= 0
);

update public.appointments appointment
set service_price_snapshot = service.price
from public.services service
where service.id = appointment.service_id
  and (
    appointment.service_price_snapshot is null
    or appointment.service_price_snapshot <> service.price
  );

create or replace function public.sync_appointment_salon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  service_salon_id uuid;
  customer_salon_id uuid;
  staff_salon_id uuid;
  service_price_value numeric(10, 2);
  assignment_exists boolean;
begin
  select salon_id, price
  into service_salon_id, service_price_value
  from public.services
  where id = new.service_id;

  select salon_id into customer_salon_id
  from public.customers
  where id = new.customer_id;

  select salon_id into staff_salon_id
  from public.staff_members
  where id = new.staff_member_id;

  if service_salon_id is null or customer_salon_id is null or staff_salon_id is null then
    raise exception 'invalid_appointment_links';
  end if;

  if service_salon_id <> customer_salon_id or service_salon_id <> staff_salon_id then
    raise exception 'service_customer_and_staff_must_belong_to_same_salon';
  end if;

  select exists (
    select 1
    from public.staff_service_assignments
    where staff_member_id = new.staff_member_id
      and service_id = new.service_id
  )
  into assignment_exists;

  if not assignment_exists then
    raise exception 'staff_member_cannot_perform_service';
  end if;

  new.salon_id := service_salon_id;
  new.service_price_snapshot := service_price_value;
  return new;
end;
$$;

create or replace function public.sync_appointment_payment_salon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_appointment public.appointments;
  expected_amount numeric(10, 2);
begin
  select *
  into target_appointment
  from public.appointments
  where id = new.appointment_id;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.status <> 'completed' then
    raise exception 'payment_requires_completed_appointment';
  end if;

  expected_amount := target_appointment.service_price_snapshot;

  if expected_amount is null then
    raise exception 'appointment_service_price_unavailable';
  end if;

  if round(new.amount::numeric, 2) <> round(expected_amount::numeric, 2) then
    raise exception 'payment_amount_must_match_service_price';
  end if;

  new.salon_id := target_appointment.salon_id;
  new.amount := expected_amount;
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');

  return new;
end;
$$;

create table if not exists public.session_security_contexts (
  session_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id_hash text not null,
  current_ip_hash text,
  user_agent_hash text,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  suspicious_events integer not null default 0 check (suspicious_events >= 0),
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_security_event_at timestamptz
);

create index if not exists session_security_contexts_user_idx
on public.session_security_contexts (user_id, last_seen_at desc);

create index if not exists session_security_contexts_risk_idx
on public.session_security_contexts (risk_level, last_seen_at desc);

alter table public.session_security_contexts enable row level security;

create or replace function public.upsert_session_security_context(
  session_id_input text,
  user_id_input uuid,
  device_id_hash_input text,
  ip_hash_input text default null,
  user_agent_hash_input text default null
)
returns table (
  allowed boolean,
  risk_level text,
  action text,
  suspicious_reason text,
  idle_timeout_seconds integer,
  suspicious_events integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_session public.session_security_contexts%rowtype;
  now_utc timestamptz := timezone('utc', now());
  next_risk_level text := 'low';
  next_action text := 'allow';
  next_reason text := null;
  next_suspicious_events integer := 0;
begin
  if coalesce(length(trim(session_id_input)), 0) = 0 then
    raise exception 'session_id_required';
  end if;

  if user_id_input is null then
    raise exception 'user_id_required';
  end if;

  if coalesce(length(trim(device_id_hash_input)), 0) = 0 then
    raise exception 'device_id_hash_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(session_id_input), 0));

  select *
  into existing_session
  from public.session_security_contexts
  where session_id = trim(session_id_input)
  for update;

  if not found then
    insert into public.session_security_contexts (
      session_id,
      user_id,
      device_id_hash,
      current_ip_hash,
      user_agent_hash,
      risk_level,
      suspicious_events,
      first_seen_at,
      last_seen_at,
      last_security_event_at
    )
    values (
      trim(session_id_input),
      user_id_input,
      trim(device_id_hash_input),
      nullif(trim(coalesce(ip_hash_input, '')), ''),
      nullif(trim(coalesce(user_agent_hash_input, '')), ''),
      'low',
      0,
      now_utc,
      now_utc,
      null
    );

    return query
    select true, 'low', 'created', null::text, 3600, 0;
    return;
  end if;

  next_risk_level := existing_session.risk_level;
  next_suspicious_events := existing_session.suspicious_events;

  if existing_session.user_id <> user_id_input then
    update public.session_security_contexts
    set
      risk_level = 'high',
      suspicious_events = existing_session.suspicious_events + 1,
      last_security_event_at = now_utc
    where session_id = existing_session.session_id;

    return query
    select
      false,
      'high',
      'revoke',
      'session_user_mismatch',
      900,
      existing_session.suspicious_events + 1;
    return;
  end if;

  if existing_session.device_id_hash <> trim(device_id_hash_input) then
    update public.session_security_contexts
    set
      risk_level = 'high',
      suspicious_events = existing_session.suspicious_events + 1,
      last_security_event_at = now_utc
    where session_id = existing_session.session_id;

    return query
    select
      false,
      'high',
      'revoke',
      'device_mismatch',
      900,
      existing_session.suspicious_events + 1;
    return;
  end if;

  if existing_session.risk_level = 'high' then
    if existing_session.last_seen_at + interval '15 minutes' <= now_utc then
      return query
      select false, 'high', 'expired', 'idle_timeout', 900, existing_session.suspicious_events;
      return;
    end if;
  elsif existing_session.risk_level = 'medium' then
    if existing_session.last_seen_at + interval '30 minutes' <= now_utc then
      return query
      select false, 'medium', 'expired', 'idle_timeout', 1800, existing_session.suspicious_events;
      return;
    end if;
  else
    if existing_session.last_seen_at + interval '60 minutes' <= now_utc then
      return query
      select false, 'low', 'expired', 'idle_timeout', 3600, existing_session.suspicious_events;
      return;
    end if;
  end if;

  if existing_session.first_seen_at + interval '7 days' <= now_utc then
    return query
    select
      false,
      existing_session.risk_level,
      'expired',
      'absolute_timeout',
      case
        when existing_session.risk_level = 'high' then 900
        when existing_session.risk_level = 'medium' then 1800
        else 3600
      end,
      existing_session.suspicious_events;
    return;
  end if;

  if (
    user_agent_hash_input is not null
    and length(trim(user_agent_hash_input)) > 0
    and existing_session.user_agent_hash is not null
    and existing_session.user_agent_hash <> trim(user_agent_hash_input)
  ) then
    update public.session_security_contexts
    set
      risk_level = 'high',
      suspicious_events = existing_session.suspicious_events + 1,
      last_security_event_at = now_utc
    where session_id = existing_session.session_id;

    return query
    select
      false,
      'high',
      'revoke',
      'user_agent_mismatch',
      900,
      existing_session.suspicious_events + 1;
    return;
  end if;

  if (
    ip_hash_input is not null
    and length(trim(ip_hash_input)) > 0
    and existing_session.current_ip_hash is not null
    and existing_session.current_ip_hash <> trim(ip_hash_input)
  ) then
    next_risk_level := case
      when existing_session.risk_level = 'high' then 'high'
      else 'medium'
    end;
    next_action := 'allow_with_warning';
    next_reason := 'ip_changed';
    next_suspicious_events := existing_session.suspicious_events + 1;
  end if;

  update public.session_security_contexts
  set
    current_ip_hash = coalesce(nullif(trim(coalesce(ip_hash_input, '')), ''), existing_session.current_ip_hash),
    user_agent_hash = coalesce(nullif(trim(coalesce(user_agent_hash_input, '')), ''), existing_session.user_agent_hash),
    risk_level = next_risk_level,
    suspicious_events = next_suspicious_events,
    last_seen_at = now_utc,
    last_security_event_at = case
      when next_reason is null then existing_session.last_security_event_at
      else now_utc
    end
  where session_id = existing_session.session_id;

  return query
  select
    true,
    next_risk_level,
    next_action,
    next_reason,
    case
      when next_risk_level = 'high' then 900
      when next_risk_level = 'medium' then 1800
      else 3600
    end,
    next_suspicious_events;
end;
$$;

revoke all on function public.upsert_session_security_context(text, uuid, text, text, text) from public;
grant execute on function public.upsert_session_security_context(text, uuid, text, text, text) to service_role;

create table if not exists public.security_request_replays (
  replay_scope text not null,
  request_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (replay_scope, request_hash)
);

create index if not exists security_request_replays_expires_at_idx
on public.security_request_replays (expires_at);

alter table public.security_request_replays enable row level security;

create or replace function public.register_security_request_replay(
  replay_scope_input text,
  request_hash_input text,
  ttl_seconds_input integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  inserted_row public.security_request_replays%rowtype;
  effective_ttl integer := greatest(coalesce(ttl_seconds_input, 30), 5);
begin
  if coalesce(length(trim(replay_scope_input)), 0) = 0 then
    raise exception 'replay_scope_required';
  end if;

  if coalesce(length(trim(request_hash_input)), 0) = 0 then
    raise exception 'request_hash_required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(trim(replay_scope_input) || ':' || trim(request_hash_input), 0)
  );

  insert into public.security_request_replays (
    replay_scope,
    request_hash,
    expires_at,
    created_at
  )
  values (
    trim(replay_scope_input),
    trim(request_hash_input),
    now_utc + make_interval(secs => effective_ttl),
    now_utc
  )
  on conflict (replay_scope, request_hash)
  do update
  set
    expires_at = excluded.expires_at,
    created_at = excluded.created_at
  where public.security_request_replays.expires_at <= now_utc
  returning *
  into inserted_row;

  return inserted_row.request_hash is not null;
end;
$$;

revoke all on function public.register_security_request_replay(text, text, integer) from public;
grant execute on function public.register_security_request_replay(text, text, integer) to service_role;

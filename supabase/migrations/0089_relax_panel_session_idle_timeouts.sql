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
    select true, 'low', 'created', null::text, 28800, 0;
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
    if existing_session.last_seen_at + interval '2 hours' <= now_utc then
      return query
      select false, 'medium', 'expired', 'idle_timeout', 7200, existing_session.suspicious_events;
      return;
    end if;
  else
    if existing_session.last_seen_at + interval '8 hours' <= now_utc then
      return query
      select false, 'low', 'expired', 'idle_timeout', 28800, existing_session.suspicious_events;
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
        when existing_session.risk_level = 'medium' then 7200
        else 28800
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
      when next_risk_level = 'medium' then 7200
      else 28800
    end,
    next_suspicious_events;
end;
$$;

revoke all on function public.upsert_session_security_context(text, uuid, text, text, text) from public;
grant execute on function public.upsert_session_security_context(text, uuid, text, text, text) to service_role;

create table if not exists private.push_dispatch_attempts (
  id uuid primary key,
  source_type text not null check (source_type in ('vacancy_alert', 'customer_notification')),
  source_record_id uuid not null,
  salon_id uuid not null references public.salons (id) on delete cascade,
  target_function_url text,
  request_payload jsonb not null default '{}'::jsonb,
  pg_net_request_id bigint,
  status text not null check (
    status in (
      'queued',
      'processing',
      'delivered',
      'partially_delivered',
      'delivery_failed',
      'enqueue_failed',
      'skipped'
    )
  ),
  response_status integer,
  response_payload jsonb,
  sent_count integer,
  failed_count integer,
  deactivated_count integer,
  error_detail text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (jsonb_typeof(request_payload) = 'object'),
  check (response_payload is null or jsonb_typeof(response_payload) = 'object')
);

create index if not exists push_dispatch_attempts_status_idx
on private.push_dispatch_attempts (status, created_at desc);

create index if not exists push_dispatch_attempts_source_idx
on private.push_dispatch_attempts (source_type, source_record_id, created_at desc);

revoke all on table private.push_dispatch_attempts from public, anon, authenticated;

create or replace function private.enqueue_push_dispatch_attempt(
  dispatch_id_input uuid,
  source_type_input text,
  source_record_id_input uuid,
  salon_id_input uuid,
  request_payload_input jsonb
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  function_url text;
  webhook_secret text;
  request_id bigint;
begin
  select value
  into function_url
  from private.runtime_config
  where key = 'vacancy_push_function_url'
  limit 1;

  select value
  into webhook_secret
  from private.runtime_config
  where key = 'vacancy_push_webhook_secret'
  limit 1;

  insert into private.push_dispatch_attempts (
    id,
    source_type,
    source_record_id,
    salon_id,
    target_function_url,
    request_payload,
    status
  )
  values (
    dispatch_id_input,
    source_type_input,
    source_record_id_input,
    salon_id_input,
    nullif(coalesce(function_url, ''), ''),
    coalesce(request_payload_input, '{}'::jsonb),
    'queued'
  )
  on conflict (id) do update
  set
    source_type = excluded.source_type,
    source_record_id = excluded.source_record_id,
    salon_id = excluded.salon_id,
    target_function_url = excluded.target_function_url,
    request_payload = excluded.request_payload,
    updated_at = timezone('utc', now());

  if nullif(coalesce(function_url, ''), '') is null
     or nullif(coalesce(webhook_secret, ''), '') is null then
    update private.push_dispatch_attempts
    set
      status = 'enqueue_failed',
      error_detail = 'missing_runtime_config',
      updated_at = timezone('utc', now())
    where id = dispatch_id_input;

    return;
  end if;

  request_id := net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-vacancy-webhook-secret', webhook_secret
    ),
    body := request_payload_input
  );

  update private.push_dispatch_attempts
  set
    pg_net_request_id = request_id,
    updated_at = timezone('utc', now())
  where id = dispatch_id_input;
exception
  when others then
    insert into private.push_dispatch_attempts (
      id,
      source_type,
      source_record_id,
      salon_id,
      target_function_url,
      request_payload,
      status,
      error_detail
    )
    values (
      dispatch_id_input,
      source_type_input,
      source_record_id_input,
      salon_id_input,
      nullif(coalesce(function_url, ''), ''),
      coalesce(request_payload_input, '{}'::jsonb),
      'enqueue_failed',
      left(sqlerrm, 1000)
    )
    on conflict (id) do update
    set
      status = 'enqueue_failed',
      target_function_url = excluded.target_function_url,
      request_payload = excluded.request_payload,
      error_detail = excluded.error_detail,
      updated_at = timezone('utc', now());
end;
$$;

create or replace function public.update_push_dispatch_attempt(
  input_dispatch_id uuid,
  status_input text,
  response_status_input integer default null,
  response_payload_input jsonb default null,
  sent_count_input integer default null,
  failed_count_input integer default null,
  deactivated_count_input integer default null,
  error_detail_input text default null
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  update private.push_dispatch_attempts
  set
    status = status_input,
    response_status = response_status_input,
    response_payload = response_payload_input,
    sent_count = sent_count_input,
    failed_count = failed_count_input,
    deactivated_count = deactivated_count_input,
    error_detail = case
      when nullif(coalesce(error_detail_input, ''), '') is not null then error_detail_input
      else error_detail
    end,
    updated_at = timezone('utc', now())
  where id = input_dispatch_id;
end;
$$;

revoke all on function public.update_push_dispatch_attempt(uuid, text, integer, jsonb, integer, integer, integer, text)
from public, anon, authenticated;
grant execute on function public.update_push_dispatch_attempt(uuid, text, integer, jsonb, integer, integer, integer, text)
to service_role;

create or replace function public.queue_vacancy_push_alert()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  dispatch_id uuid := gen_random_uuid();
begin
  perform private.enqueue_push_dispatch_attempt(
    dispatch_id,
    'vacancy_alert',
    new.id,
    new.salon_id,
    jsonb_build_object(
      'dispatch_id', dispatch_id,
      'alert_id', new.id,
      'salon_id', new.salon_id
    )
  );

  return new;
end;
$$;

create or replace function public.queue_customer_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  dispatch_id uuid := gen_random_uuid();
begin
  perform private.enqueue_push_dispatch_attempt(
    dispatch_id,
    'customer_notification',
    new.id,
    new.salon_id,
    jsonb_build_object(
      'dispatch_id', dispatch_id,
      'notification_id', new.id,
      'salon_id', new.salon_id
    )
  );

  return new;
end;
$$;

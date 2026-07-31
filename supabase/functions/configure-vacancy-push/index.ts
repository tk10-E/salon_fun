import postgres from "npm:postgres@3.4.7";

const jsonHeaders = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

const migrationSql = `
create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.runtime_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

create table if not exists public.customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  device_platform text not null check (device_platform in ('android', 'ios', 'web')),
  device_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(token)) >= 20)
);

create index if not exists customer_push_tokens_salon_idx
on public.customer_push_tokens (salon_id, is_active, last_seen_at desc);

create index if not exists customer_push_tokens_auth_user_idx
on public.customer_push_tokens (auth_user_id);

alter table public.customer_push_tokens enable row level security;

drop policy if exists "customers_manage_own_push_tokens" on public.customer_push_tokens;
drop policy if exists "owners_read_salon_push_tokens" on public.customer_push_tokens;

create policy "customers_manage_own_push_tokens"
on public.customer_push_tokens
for all
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "owners_read_salon_push_tokens"
on public.customer_push_tokens
for select
to authenticated
using (public.is_owner_of_salon(salon_id));

create or replace function public.register_customer_push_token(
  input_token text,
  device_platform_input text,
  device_label_input text default null
)
returns public.customer_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  normalized_token text;
  normalized_platform text;
  saved_token public.customer_push_tokens;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid();

  if customer_profile.id is null then
    raise exception 'customer_not_found';
  end if;

  normalized_token := nullif(btrim(coalesce(input_token, '')), '');
  normalized_platform := lower(nullif(btrim(coalesce(device_platform_input, '')), ''));

  if normalized_token is null then
    raise exception 'push_token_required';
  end if;

  if normalized_platform not in ('android', 'ios', 'web') then
    raise exception 'invalid_push_platform';
  end if;

  insert into public.customer_push_tokens (
    customer_id,
    salon_id,
    auth_user_id,
    token,
    device_platform,
    device_label,
    is_active,
    updated_at,
    last_seen_at
  )
  values (
    customer_profile.id,
    customer_profile.salon_id,
    auth.uid(),
    normalized_token,
    normalized_platform,
    nullif(btrim(coalesce(device_label_input, '')), ''),
    true,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (token) do update
  set
    customer_id = excluded.customer_id,
    salon_id = excluded.salon_id,
    auth_user_id = excluded.auth_user_id,
    device_platform = excluded.device_platform,
    device_label = coalesce(excluded.device_label, public.customer_push_tokens.device_label),
    is_active = true,
    updated_at = timezone('utc', now()),
    last_seen_at = timezone('utc', now())
  returning * into saved_token;

  return saved_token;
end;
$$;

create or replace function public.deactivate_customer_push_token(input_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_token text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  normalized_token := nullif(btrim(coalesce(input_token, '')), '');

  if normalized_token is null then
    return;
  end if;

  update public.customer_push_tokens
  set
    is_active = false,
    updated_at = timezone('utc', now())
  where token = normalized_token
    and auth_user_id = auth.uid();
end;
$$;

grant execute on function public.register_customer_push_token(text, text, text) to authenticated;
grant execute on function public.deactivate_customer_push_token(text) to authenticated;

create or replace function public.queue_vacancy_push_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  webhook_secret text;
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

  if nullif(coalesce(function_url, ''), '') is null
     or nullif(coalesce(webhook_secret, ''), '') is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-vacancy-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'alert_id', new.id,
      'salon_id', new.salon_id
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists salon_vacancy_alerts_dispatch_push on public.salon_vacancy_alerts;

create trigger salon_vacancy_alerts_dispatch_push
after insert on public.salon_vacancy_alerts
for each row
execute function public.queue_vacancy_push_alert();

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
`;

Deno.serve(async (request: Request) => {
  if (request.method != "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("VACANCY_PUSH_WEBHOOK_SECRET");
  const receivedSecret = request.headers.get("x-vacancy-webhook-secret");

  if (!expectedSecret || expectedSecret !== receivedSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return jsonResponse({ error: "missing_db_url" }, 500);
  }

  const functionUrl = new URL("/functions/v1/send-vacancy-push", request.url);
  functionUrl.protocol = "https:";
  const pushFunctionUrl = functionUrl.toString();

  const sql = postgres(dbUrl, {
    prepare: false,
    max: 1,
  });

  try {
    await sql.unsafe(migrationSql);
    await sql`
      insert into private.runtime_config (key, value)
      values
        ('vacancy_push_function_url', ${pushFunctionUrl}),
        ('vacancy_push_webhook_secret', ${expectedSecret})
      on conflict (key)
      do update set
        value = excluded.value,
        updated_at = timezone('utc', now())
    `;

    const rows: Array<{ key: string }> = await sql`
      select key
      from private.runtime_config
      where key in ('vacancy_push_function_url', 'vacancy_push_webhook_secret')
      order by key
    `;

    return jsonResponse({
      ok: true,
      configured: rows.map((row: { key: string }) => row.key),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "configuration_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
});

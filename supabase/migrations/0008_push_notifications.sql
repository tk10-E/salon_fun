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
set search_path = public, extensions
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

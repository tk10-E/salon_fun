create table if not exists public.customer_notification_receipts (
  customer_id uuid not null references public.customers (id) on delete cascade,
  source_type text not null check (source_type in ('salon_notification', 'vacancy_alert')),
  source_id uuid not null,
  read_at timestamptz not null default timezone('utc', now()),
  primary key (customer_id, source_type, source_id)
);

create index if not exists customer_notification_receipts_customer_idx
on public.customer_notification_receipts (customer_id, read_at desc);

alter table public.customer_notification_receipts enable row level security;

drop policy if exists "customers_manage_own_notification_receipts" on public.customer_notification_receipts;

create policy "customers_manage_own_notification_receipts"
on public.customer_notification_receipts
for all
to authenticated
using (
  exists (
    select 1
    from public.customers customer_profile
    where customer_profile.id = customer_id
      and customer_profile.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.customers customer_profile
    where customer_profile.id = customer_id
      and customer_profile.auth_user_id = auth.uid()
  )
);

create or replace function public.mark_customer_notifications_read(
  salon_notification_ids uuid[] default '{}'::uuid[],
  vacancy_alert_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
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

  insert into public.customer_notification_receipts (
    customer_id,
    source_type,
    source_id,
    read_at
  )
  select
    customer_profile.id,
    'salon_notification',
    notification_id,
    timezone('utc', now())
  from unnest(coalesce(salon_notification_ids, '{}'::uuid[])) as notification_id
  on conflict (customer_id, source_type, source_id) do update
  set read_at = excluded.read_at;

  insert into public.customer_notification_receipts (
    customer_id,
    source_type,
    source_id,
    read_at
  )
  select
    customer_profile.id,
    'vacancy_alert',
    alert_id,
    timezone('utc', now())
  from unnest(coalesce(vacancy_alert_ids, '{}'::uuid[])) as alert_id
  on conflict (customer_id, source_type, source_id) do update
  set read_at = excluded.read_at;
end;
$$;

grant execute on function public.mark_customer_notifications_read(uuid[], uuid[]) to authenticated;

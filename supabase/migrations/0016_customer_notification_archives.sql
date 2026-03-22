alter table public.customer_notification_receipts
add column if not exists archived_at timestamptz;

create index if not exists customer_notification_receipts_archived_idx
on public.customer_notification_receipts (customer_id, archived_at desc)
where archived_at is not null;

create or replace function public.archive_customer_notifications(
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
  archived_at_value timestamptz := timezone('utc', now());
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
    read_at,
    archived_at
  )
  select
    customer_profile.id,
    'salon_notification',
    notification_id,
    archived_at_value,
    archived_at_value
  from unnest(coalesce(salon_notification_ids, '{}'::uuid[])) as notification_id
  on conflict (customer_id, source_type, source_id) do update
  set
    read_at = customer_notification_receipts.read_at,
    archived_at = archived_at_value;

  insert into public.customer_notification_receipts (
    customer_id,
    source_type,
    source_id,
    read_at,
    archived_at
  )
  select
    customer_profile.id,
    'vacancy_alert',
    alert_id,
    archived_at_value,
    archived_at_value
  from unnest(coalesce(vacancy_alert_ids, '{}'::uuid[])) as alert_id
  on conflict (customer_id, source_type, source_id) do update
  set
    read_at = customer_notification_receipts.read_at,
    archived_at = archived_at_value;
end;
$$;

grant execute on function public.archive_customer_notifications(uuid[], uuid[]) to authenticated;

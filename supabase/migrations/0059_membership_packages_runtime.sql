alter table public.salon_offers
add column if not exists membership_service_id uuid references public.services (id) on delete set null,
add column if not exists membership_sessions_included integer,
add column if not exists membership_validity_days integer;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'salon_offers_membership_operational_shape_check'
      and conrelid = 'public.salon_offers'::regclass
  ) then
    alter table public.salon_offers
    drop constraint salon_offers_membership_operational_shape_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'salon_offers_promotion_operational_blank_check'
      and conrelid = 'public.salon_offers'::regclass
  ) then
    alter table public.salon_offers
    drop constraint salon_offers_promotion_operational_blank_check;
  end if;
end
$$;

alter table public.salon_offers
add constraint salon_offers_membership_operational_shape_check
check (
  kind <> 'membership'
  or (
    (
      membership_service_id is null
      and membership_sessions_included is null
      and membership_validity_days is null
    )
    or (
      membership_service_id is not null
      and membership_sessions_included is not null
      and membership_sessions_included > 0
      and membership_validity_days is not null
      and membership_validity_days > 0
    )
  )
);

alter table public.salon_offers
add constraint salon_offers_promotion_operational_blank_check
check (
  kind = 'membership'
  or (
    membership_service_id is null
    and membership_sessions_included is null
    and membership_validity_days is null
  )
);

create index if not exists salon_offers_membership_service_idx
on public.salon_offers (salon_id, kind, membership_service_id, is_active, sort_order)
where kind = 'membership';

create table if not exists public.customer_memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  offer_id uuid references public.salon_offers (id) on delete set null,
  title text not null,
  service_id uuid references public.services (id) on delete set null,
  service_name_snapshot text not null,
  price_snapshot numeric(10, 2) check (price_snapshot is null or price_snapshot >= 0),
  sessions_included integer not null check (sessions_included > 0),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  started_at date not null default current_date,
  expires_at date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(title)) between 1 and 120),
  check (char_length(btrim(service_name_snapshot)) between 1 and 120),
  check (notes is null or char_length(btrim(notes)) between 1 and 1000),
  check (sessions_used <= sessions_included),
  check (expires_at >= started_at)
);

create index if not exists customer_memberships_salon_customer_idx
on public.customer_memberships (salon_id, customer_id, status, expires_at, created_at desc);

create index if not exists customer_memberships_customer_idx
on public.customer_memberships (customer_id, created_at desc);

create or replace function public.touch_customer_membership_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_memberships_touch_updated_at on public.customer_memberships;

create trigger customer_memberships_touch_updated_at
before update on public.customer_memberships
for each row
execute function public.touch_customer_membership_updated_at();

alter table public.customer_memberships enable row level security;

drop policy if exists "owners_manage_customer_memberships" on public.customer_memberships;
drop policy if exists "customers_read_own_memberships" on public.customer_memberships;

create policy "owners_manage_customer_memberships"
on public.customer_memberships
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_memberships"
on public.customer_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.customers customer
    where customer.id = customer_id
      and customer.auth_user_id = auth.uid()
  )
);

create table if not exists public.customer_membership_redemptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  membership_id uuid not null references public.customer_memberships (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  redemption_kind text not null default 'appointment_completion' check (redemption_kind in ('appointment_completion', 'manual')),
  notes text,
  redeemed_at timestamptz not null default timezone('utc', now()),
  reversed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (notes is null or char_length(btrim(notes)) between 1 and 1000)
);

create index if not exists customer_membership_redemptions_membership_idx
on public.customer_membership_redemptions (membership_id, redeemed_at desc);

create index if not exists customer_membership_redemptions_customer_idx
on public.customer_membership_redemptions (customer_id, redeemed_at desc);

create unique index if not exists customer_membership_redemptions_active_appointment_idx
on public.customer_membership_redemptions (appointment_id)
where reversed_at is null;

alter table public.customer_membership_redemptions enable row level security;

drop policy if exists "owners_manage_customer_membership_redemptions" on public.customer_membership_redemptions;

create policy "owners_manage_customer_membership_redemptions"
on public.customer_membership_redemptions
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create or replace function public.refresh_customer_membership_usage(
  membership_uuid uuid
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_record public.customer_memberships;
  used_sessions integer := 0;
begin
  select *
  into membership_record
  from public.customer_memberships
  where id = membership_uuid
  for update;

  if membership_record.id is null then
    raise exception 'membership_not_found';
  end if;

  select coalesce(sum(quantity), 0)
  into used_sessions
  from public.customer_membership_redemptions redemption
  where redemption.membership_id = membership_uuid
    and redemption.reversed_at is null;

  update public.customer_memberships
  set
    sessions_used = least(used_sessions, membership_record.sessions_included),
    status = case
      when membership_record.status = 'cancelled' then 'cancelled'
      when used_sessions >= membership_record.sessions_included then 'completed'
      when membership_record.expires_at < current_date then 'expired'
      else 'active'
    end
  where id = membership_record.id
  returning * into membership_record;

  return membership_record;
end;
$$;

create or replace function public.refresh_customer_membership_usage_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_customer_membership_usage(
    coalesce(new.membership_id, old.membership_id)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists customer_membership_redemptions_refresh_usage on public.customer_membership_redemptions;

create trigger customer_membership_redemptions_refresh_usage
after insert or update or delete on public.customer_membership_redemptions
for each row
execute function public.refresh_customer_membership_usage_trigger();

create or replace function public.assign_customer_membership_package(
  customer_uuid uuid,
  offer_uuid uuid,
  starts_on_input date default null,
  notes_input text default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  target_customer public.customers;
  offer_record record;
  started_on date := coalesce(starts_on_input, current_date);
  expires_on date;
  inserted_membership public.customer_memberships;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select *
  into target_customer
  from public.customers
  where id = customer_uuid
    and salon_id = owner_salon.id;

  if target_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select
    offer.*,
    service.name as membership_service_name
  into offer_record
  from public.salon_offers offer
  left join public.services service
    on service.id = offer.membership_service_id
  where offer.id = offer_uuid
    and offer.salon_id = owner_salon.id;

  if offer_record.id is null then
    raise exception 'offer_not_found';
  end if;

  if offer_record.kind <> 'membership' then
    raise exception 'offer_not_membership';
  end if;

  if offer_record.membership_service_id is null
    or offer_record.membership_sessions_included is null
    or offer_record.membership_validity_days is null
    or coalesce(offer_record.membership_service_name, '') = ''
  then
    raise exception 'membership_offer_not_operational';
  end if;

  expires_on := started_on + (greatest(offer_record.membership_validity_days, 1) - 1);

  insert into public.customer_memberships (
    salon_id,
    customer_id,
    offer_id,
    title,
    service_id,
    service_name_snapshot,
    price_snapshot,
    sessions_included,
    sessions_used,
    started_at,
    expires_at,
    status,
    notes
  )
  values (
    owner_salon.id,
    target_customer.id,
    offer_record.id,
    offer_record.title,
    offer_record.membership_service_id,
    offer_record.membership_service_name,
    offer_record.price,
    offer_record.membership_sessions_included,
    0,
    started_on,
    expires_on,
    case
      when expires_on < current_date then 'expired'
      else 'active'
    end,
    nullif(btrim(notes_input), '')
  )
  returning * into inserted_membership;

  return inserted_membership;
end;
$$;

grant execute on function public.assign_customer_membership_package(uuid, uuid, date, text)
to authenticated;

create or replace function public.consume_customer_membership_package(
  appointment_uuid uuid,
  membership_uuid uuid default null,
  notes_input text default null
)
returns public.customer_membership_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  target_appointment public.appointments;
  selected_membership public.customer_memberships;
  inserted_redemption public.customer_membership_redemptions;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid
    and salon_id = owner_salon.id;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.status <> 'completed' then
    raise exception 'appointment_not_completed';
  end if;

  if exists (
    select 1
    from public.customer_membership_redemptions redemption
    where redemption.appointment_id = target_appointment.id
      and redemption.reversed_at is null
  ) then
    raise exception 'appointment_membership_already_consumed';
  end if;

  if membership_uuid is null then
    select *
    into selected_membership
    from public.customer_memberships membership
    where membership.salon_id = owner_salon.id
      and membership.customer_id = target_appointment.customer_id
      and membership.service_id = target_appointment.service_id
      and membership.status <> 'cancelled'
      and membership.sessions_used < membership.sessions_included
      and membership.expires_at >= current_date
    order by membership.expires_at asc, membership.started_at asc, membership.created_at asc
    limit 1
    for update;
  else
    select *
    into selected_membership
    from public.customer_memberships membership
    where membership.id = membership_uuid
      and membership.salon_id = owner_salon.id
    for update;
  end if;

  if selected_membership.id is null then
    raise exception 'membership_not_found';
  end if;

  perform public.refresh_customer_membership_usage(selected_membership.id);

  select *
  into selected_membership
  from public.customer_memberships
  where id = selected_membership.id
  for update;

  if selected_membership.customer_id <> target_appointment.customer_id then
    raise exception 'membership_customer_mismatch';
  end if;

  if selected_membership.service_id is distinct from target_appointment.service_id then
    raise exception 'membership_service_mismatch';
  end if;

  if selected_membership.status = 'cancelled' then
    raise exception 'membership_cancelled';
  end if;

  if selected_membership.expires_at < current_date or selected_membership.status = 'expired' then
    raise exception 'membership_expired';
  end if;

  if selected_membership.sessions_used >= selected_membership.sessions_included
    or selected_membership.status = 'completed'
  then
    raise exception 'membership_no_sessions_remaining';
  end if;

  insert into public.customer_membership_redemptions (
    salon_id,
    membership_id,
    customer_id,
    appointment_id,
    service_id,
    quantity,
    redemption_kind,
    notes
  )
  values (
    owner_salon.id,
    selected_membership.id,
    target_appointment.customer_id,
    target_appointment.id,
    target_appointment.service_id,
    1,
    'appointment_completion',
    nullif(btrim(notes_input), '')
  )
  returning * into inserted_redemption;

  perform public.refresh_customer_membership_usage(selected_membership.id);

  return inserted_redemption;
end;
$$;

grant execute on function public.consume_customer_membership_package(uuid, uuid, text)
to authenticated;

create or replace function public.reverse_customer_membership_package_consumption(
  appointment_uuid uuid
)
returns public.customer_membership_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  target_redemption public.customer_membership_redemptions;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select redemption.*
  into target_redemption
  from public.customer_membership_redemptions redemption
  where redemption.salon_id = owner_salon.id
    and redemption.appointment_id = appointment_uuid
    and redemption.reversed_at is null
  order by redemption.redeemed_at desc
  limit 1
  for update;

  if target_redemption.id is null then
    raise exception 'membership_redemption_not_found';
  end if;

  update public.customer_membership_redemptions
  set reversed_at = timezone('utc', now())
  where id = target_redemption.id
  returning * into target_redemption;

  perform public.refresh_customer_membership_usage(target_redemption.membership_id);

  return target_redemption;
end;
$$;

grant execute on function public.reverse_customer_membership_package_consumption(uuid)
to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_memberships'
  ) then
    null;
  else
    alter publication supabase_realtime add table public.customer_memberships;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_membership_redemptions'
  ) then
    null;
  else
    alter publication supabase_realtime add table public.customer_membership_redemptions;
  end if;
end
$$;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  generated_code text;
begin
  generated_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  return generated_code;
end;
$$;

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  join_code text not null unique default public.generate_join_code(),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration integer not null check (duration > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  date timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_at > date)
);

create index services_salon_id_idx on public.services (salon_id);
create index customers_salon_id_idx on public.customers (salon_id);
create index appointments_salon_id_idx on public.appointments (salon_id);
create index appointments_customer_id_idx on public.appointments (customer_id);
create index appointments_date_idx on public.appointments (date);

alter table public.appointments
add constraint appointments_no_overlap
exclude using gist (
  salon_id with =,
  tstzrange(date, ends_at, '[)') with &&
)
where (status in ('pending', 'confirmed'));

create or replace function public.sync_appointment_salon()
returns trigger
language plpgsql
as $$
declare
  service_salon_id uuid;
  customer_salon_id uuid;
begin
  select salon_id into service_salon_id
  from public.services
  where id = new.service_id;

  select salon_id into customer_salon_id
  from public.customers
  where id = new.customer_id;

  if service_salon_id is null or customer_salon_id is null then
    raise exception 'invalid_appointment_links';
  end if;

  if service_salon_id <> customer_salon_id then
    raise exception 'service_and_customer_must_belong_to_same_salon';
  end if;

  new.salon_id := service_salon_id;
  return new;
end;
$$;

create trigger appointments_sync_salon
before insert or update of customer_id, service_id
on public.appointments
for each row
execute function public.sync_appointment_salon();

create or replace function public.current_owner_salon_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.salons
  where owner_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_customer_salon_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select salon_id
  from public.customers
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_owner_of_salon(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.salons
    where id = target_salon_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_customer_of_salon(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where salon_id = target_salon_id
      and auth_user_id = auth.uid()
  );
$$;

alter table public.salons enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;

create policy "owners_select_their_salon"
on public.salons
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_customer_of_salon(id)
);

create policy "owners_insert_their_salon"
on public.salons
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "owners_update_their_salon"
on public.salons
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "owners_manage_services"
on public.services
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_services_from_their_salon"
on public.services
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

create policy "owners_read_customers"
on public.customers
for select
to authenticated
using (
  public.is_owner_of_salon(salon_id)
  or auth_user_id = auth.uid()
);

create policy "customers_update_their_profile"
on public.customers
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "owners_read_and_update_appointments"
on public.appointments
for select
to authenticated
using (
  public.is_owner_of_salon(salon_id)
  or customer_id in (
    select id
    from public.customers
    where auth_user_id = auth.uid()
  )
);

create policy "owners_update_appointments"
on public.appointments
for update
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create or replace function public.join_salon(input_join_code text, customer_name text)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_salon public.salons;
  existing_customer public.customers;
  linked_customer public.customers;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if trim(coalesce(customer_name, '')) = '' then
    raise exception 'customer_name_required';
  end if;

  select *
  into target_salon
  from public.salons
  where public.salons.join_code = upper(trim(input_join_code));

  if target_salon.id is null then
    raise exception 'invalid_salon_code';
  end if;

  select *
  into existing_customer
  from public.customers
  where auth_user_id = auth.uid();

  if existing_customer.id is not null and existing_customer.salon_id <> target_salon.id then
    raise exception 'customer_already_linked_to_another_salon';
  end if;

  insert into public.customers (salon_id, auth_user_id, name)
  values (target_salon.id, auth.uid(), trim(customer_name))
  on conflict (auth_user_id)
  do update set name = excluded.name
  returning * into linked_customer;

  return linked_customer;
end;
$$;

create or replace function public.create_appointment(service_uuid uuid, requested_date timestamptz)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  selected_service public.services;
  created_appointment public.appointments;
  requested_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid();

  if customer_profile.id is null then
    raise exception 'customer_not_linked';
  end if;

  select *
  into selected_service
  from public.services
  where id = service_uuid
    and salon_id = customer_profile.salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  requested_end := requested_date + make_interval(mins => selected_service.duration);

  insert into public.appointments (salon_id, customer_id, service_id, date, ends_at, status)
  values (
    customer_profile.salon_id,
    customer_profile.id,
    selected_service.id,
    requested_date,
    requested_end,
    'pending'
  )
  returning * into created_appointment;

  return created_appointment;
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

create or replace function public.get_busy_slots(target_day date)
returns table (date timestamptz, ends_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select a.date, a.ends_at
  from public.appointments a
  join public.customers c
    on c.salon_id = a.salon_id
  where c.auth_user_id = auth.uid()
    and a.status in ('pending', 'confirmed')
    and a.date >= target_day::timestamptz
    and a.date < (target_day::timestamptz + interval '1 day')
  order by a.date;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.join_salon(text, text) to authenticated;
grant execute on function public.create_appointment(uuid, timestamptz) to authenticated;
grant execute on function public.get_busy_slots(date) to authenticated;
grant execute on function public.generate_join_code() to authenticated;

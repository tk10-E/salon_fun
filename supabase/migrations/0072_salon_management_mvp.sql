create or replace function public.touch_management_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_owner_salon_id() references public.salons (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(name)) between 2 and 80),
  check (description is null or char_length(btrim(description)) between 1 and 280)
);

create unique index if not exists service_categories_salon_lower_name_uidx
on public.service_categories (salon_id, lower(name));

create index if not exists service_categories_salon_active_idx
on public.service_categories (salon_id, is_active, name);

drop trigger if exists service_categories_touch_updated_at on public.service_categories;

create trigger service_categories_touch_updated_at
before update on public.service_categories
for each row
execute function public.touch_management_updated_at();

alter table public.service_categories enable row level security;

drop policy if exists "owners_manage_service_categories" on public.service_categories;
drop policy if exists "customers_read_active_service_categories" on public.service_categories;

create policy "owners_manage_service_categories"
on public.service_categories
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_active_service_categories"
on public.service_categories
for select
to authenticated
using (public.is_customer_of_salon(salon_id) and is_active);

alter table public.services
add column if not exists service_category_id uuid references public.service_categories (id) on delete restrict,
add column if not exists is_active boolean not null default true,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.services
set category = 'Geral'
where category is null or btrim(category) = '';

insert into public.service_categories (salon_id, name)
select distinct
  service.salon_id,
  service.category
from public.services service
where not exists (
  select 1
  from public.service_categories category
  where category.salon_id = service.salon_id
    and lower(category.name) = lower(service.category)
);

update public.services service
set service_category_id = category.id
from public.service_categories category
where category.salon_id = service.salon_id
  and lower(category.name) = lower(service.category)
  and service.service_category_id is null;

alter table public.services
alter column service_category_id set not null;

create index if not exists services_salon_category_active_idx
on public.services (salon_id, service_category_id, is_active, sort_order, name);

update public.services
set updated_at = created_at
where updated_at is null;

drop trigger if exists services_touch_management_updated_at on public.services;

create trigger services_touch_management_updated_at
before update on public.services
for each row
execute function public.touch_management_updated_at();

create or replace function public.sync_service_category_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_category public.service_categories;
begin
  select *
  into selected_category
  from public.service_categories
  where id = new.service_category_id;

  if selected_category.id is null then
    raise exception 'service_category_not_found';
  end if;

  if selected_category.salon_id <> new.salon_id then
    raise exception 'service_category_must_belong_to_same_salon';
  end if;

  new.category := selected_category.name;
  return new;
end;
$$;

drop trigger if exists services_sync_category_snapshot on public.services;

create trigger services_sync_category_snapshot
before insert or update of salon_id, service_category_id
on public.services
for each row
execute function public.sync_service_category_snapshot();

drop policy if exists "customers_read_services_from_their_salon" on public.services;

create policy "customers_read_services_from_their_salon"
on public.services
for select
to authenticated
using (public.is_customer_of_salon(salon_id) and is_active);

alter table public.customers
alter column auth_user_id drop not null;

alter table public.customers
add column if not exists email text,
add column if not exists whatsapp_phone text,
add column if not exists notes text,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.customers
set updated_at = created_at
where updated_at is null;

alter table public.customers
drop constraint if exists customers_email_length_check,
drop constraint if exists customers_whatsapp_phone_length_check,
drop constraint if exists customers_notes_length_check;

alter table public.customers
add constraint customers_email_length_check
check (email is null or char_length(btrim(email)) between 5 and 180),
add constraint customers_whatsapp_phone_length_check
check (whatsapp_phone is null or char_length(btrim(whatsapp_phone)) between 8 and 30),
add constraint customers_notes_length_check
check (notes is null or char_length(btrim(notes)) between 1 and 2000);

drop trigger if exists customers_touch_management_updated_at on public.customers;

create trigger customers_touch_management_updated_at
before update on public.customers
for each row
execute function public.touch_management_updated_at();

drop policy if exists "owners_manage_customers" on public.customers;

create policy "owners_manage_customers"
on public.customers
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

alter table public.staff_members
add column if not exists phone text;

alter table public.staff_members
drop constraint if exists staff_members_phone_length_check;

alter table public.staff_members
add constraint staff_members_phone_length_check
check (phone is null or char_length(btrim(phone)) between 8 and 30);

do $$
begin
  alter type public.appointment_status add value if not exists 'no_show';
exception
  when duplicate_object then
    null;
end;
$$;

alter table public.appointments
add column if not exists notes text,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.appointments
set updated_at = created_at
where updated_at is null;

alter table public.appointments
drop constraint if exists appointments_notes_length_check;

alter table public.appointments
add constraint appointments_notes_length_check
check (notes is null or char_length(btrim(notes)) between 1 and 1000);

drop trigger if exists appointments_touch_management_updated_at on public.appointments;

create trigger appointments_touch_management_updated_at
before update on public.appointments
for each row
execute function public.touch_management_updated_at();

create or replace function public.validate_appointment_active_resources()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_service public.services;
  selected_staff public.staff_members;
  selected_category public.service_categories;
begin
  select *
  into selected_service
  from public.services
  where id = new.service_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  if not selected_service.is_active then
    raise exception 'inactive_service_not_allowed';
  end if;

  if selected_service.service_category_id is null then
    raise exception 'service_category_required';
  end if;

  select *
  into selected_category
  from public.service_categories
  where id = selected_service.service_category_id;

  if selected_category.id is null then
    raise exception 'service_category_not_found';
  end if;

  if not selected_category.is_active then
    raise exception 'inactive_service_category_not_allowed';
  end if;

  select *
  into selected_staff
  from public.staff_members
  where id = new.staff_member_id;

  if selected_staff.id is null then
    raise exception 'staff_member_not_found';
  end if;

  if not selected_staff.is_active then
    raise exception 'inactive_staff_member_not_allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_validate_active_resources on public.appointments;

create trigger appointments_validate_active_resources
before insert or update of service_id, staff_member_id
on public.appointments
for each row
execute function public.validate_appointment_active_resources();

do $$
begin
  create type public.appointment_payment_method as enum ('pix', 'cash', 'debit_card', 'credit_card');
exception
  when duplicate_object then
    null;
end;
$$;

create table if not exists public.appointment_payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method public.appointment_payment_method not null,
  paid_at timestamptz not null default timezone('utc', now()),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (notes is null or char_length(btrim(notes)) between 1 and 500)
);

create index if not exists appointment_payments_salon_paid_at_idx
on public.appointment_payments (salon_id, paid_at desc);

create index if not exists appointment_payments_method_idx
on public.appointment_payments (salon_id, payment_method, paid_at desc);

drop trigger if exists appointment_payments_touch_updated_at on public.appointment_payments;

create trigger appointment_payments_touch_updated_at
before update on public.appointment_payments
for each row
execute function public.touch_management_updated_at();

create or replace function public.sync_appointment_payment_salon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_appointment public.appointments;
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

  new.salon_id := target_appointment.salon_id;
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');

  return new;
end;
$$;

drop trigger if exists appointment_payments_sync_salon on public.appointment_payments;

create trigger appointment_payments_sync_salon
before insert or update of appointment_id, notes
on public.appointment_payments
for each row
execute function public.sync_appointment_payment_salon();

alter table public.appointment_payments enable row level security;

drop policy if exists "owners_manage_appointment_payments" on public.appointment_payments;

create policy "owners_manage_appointment_payments"
on public.appointment_payments
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

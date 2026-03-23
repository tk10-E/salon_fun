alter table public.customers
add column if not exists phone text,
add column if not exists preferences text;

create table if not exists public.customer_favorite_services (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default public.current_customer_id() references public.customers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, service_id)
);

create table if not exists public.customer_favorite_staff_members (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default public.current_customer_id() references public.customers (id) on delete cascade,
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, staff_member_id)
);

create index if not exists customer_favorite_services_customer_id_idx
on public.customer_favorite_services (customer_id, created_at desc);

create index if not exists customer_favorite_services_service_id_idx
on public.customer_favorite_services (service_id);

create index if not exists customer_favorite_staff_members_customer_id_idx
on public.customer_favorite_staff_members (customer_id, created_at desc);

create index if not exists customer_favorite_staff_members_staff_member_id_idx
on public.customer_favorite_staff_members (staff_member_id);

create or replace function public.ensure_customer_favorite_service_matches_salon()
returns trigger
language plpgsql
as $$
declare
  customer_salon_id uuid;
  service_salon_id uuid;
begin
  select salon_id
  into customer_salon_id
  from public.customers
  where id = new.customer_id;

  select salon_id
  into service_salon_id
  from public.services
  where id = new.service_id;

  if customer_salon_id is null or service_salon_id is null or customer_salon_id <> service_salon_id then
    raise exception 'favorite_service_must_belong_to_customer_salon';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_customer_favorite_staff_matches_salon()
returns trigger
language plpgsql
as $$
declare
  customer_salon_id uuid;
  staff_salon_id uuid;
begin
  select salon_id
  into customer_salon_id
  from public.customers
  where id = new.customer_id;

  select salon_id
  into staff_salon_id
  from public.staff_members
  where id = new.staff_member_id;

  if customer_salon_id is null or staff_salon_id is null or customer_salon_id <> staff_salon_id then
    raise exception 'favorite_staff_member_must_belong_to_customer_salon';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_favorite_services_match_salon on public.customer_favorite_services;
create trigger customer_favorite_services_match_salon
before insert or update on public.customer_favorite_services
for each row
execute function public.ensure_customer_favorite_service_matches_salon();

drop trigger if exists customer_favorite_staff_members_match_salon on public.customer_favorite_staff_members;
create trigger customer_favorite_staff_members_match_salon
before insert or update on public.customer_favorite_staff_members
for each row
execute function public.ensure_customer_favorite_staff_matches_salon();

alter table public.customer_favorite_services enable row level security;
alter table public.customer_favorite_staff_members enable row level security;

drop policy if exists "customers_manage_favorite_services" on public.customer_favorite_services;
drop policy if exists "customers_manage_favorite_staff_members" on public.customer_favorite_staff_members;

create policy "customers_manage_favorite_services"
on public.customer_favorite_services
for all
to authenticated
using (customer_id = public.current_customer_id())
with check (customer_id = public.current_customer_id());

create policy "customers_manage_favorite_staff_members"
on public.customer_favorite_staff_members
for all
to authenticated
using (customer_id = public.current_customer_id())
with check (customer_id = public.current_customer_id());

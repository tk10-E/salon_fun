create table if not exists public.salon_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_owner_salon_id() references public.salons (id) on delete cascade,
  reference_month date not null,
  revenue_goal numeric(10, 2) not null default 0,
  completed_appointments_goal integer not null default 0,
  served_customers_goal integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (reference_month = date_trunc('month', reference_month)::date),
  check (revenue_goal >= 0),
  check (completed_appointments_goal >= 0),
  check (served_customers_goal >= 0)
);

create unique index if not exists salon_monthly_targets_salon_month_uidx
on public.salon_monthly_targets (salon_id, reference_month);

create index if not exists salon_monthly_targets_salon_month_idx
on public.salon_monthly_targets (salon_id, reference_month desc);

drop trigger if exists salon_monthly_targets_touch_updated_at on public.salon_monthly_targets;

create trigger salon_monthly_targets_touch_updated_at
before update on public.salon_monthly_targets
for each row
execute function public.touch_management_updated_at();

alter table public.salon_monthly_targets enable row level security;

drop policy if exists "owners_manage_salon_monthly_targets" on public.salon_monthly_targets;

create policy "owners_manage_salon_monthly_targets"
on public.salon_monthly_targets
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

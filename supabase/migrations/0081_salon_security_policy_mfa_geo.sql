create or replace function public.security_country_codes_are_valid(country_codes text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    bool_and(code ~ '^[A-Z]{2}$'),
    true
  )
  from unnest(coalesce(country_codes, array[]::text[])) as code
$$;

create table if not exists public.salon_security_settings (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  mfa_totp_enabled boolean not null default false,
  geo_allowlist_enabled boolean not null default false,
  allowed_country_codes text[] not null default array[]::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (public.security_country_codes_are_valid(allowed_country_codes))
);

insert into public.salon_security_settings (salon_id)
select salon.id
from public.salons salon
on conflict (salon_id) do nothing;

drop trigger if exists salon_security_settings_touch_updated_at
on public.salon_security_settings;

create trigger salon_security_settings_touch_updated_at
before update on public.salon_security_settings
for each row
execute function public.touch_management_updated_at();

alter table public.salon_security_settings enable row level security;

drop policy if exists "owners_manage_salon_security_settings"
on public.salon_security_settings;

create policy "owners_manage_salon_security_settings"
on public.salon_security_settings
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

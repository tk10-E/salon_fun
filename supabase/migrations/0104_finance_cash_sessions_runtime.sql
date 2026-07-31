create table if not exists public.salon_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  session_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default timezone('utc', now()),
  opened_by uuid references auth.users (id) on delete set null,
  opening_amount numeric(12, 2) not null default 0 check (opening_amount >= 0),
  opening_note text,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  closing_reported_amount numeric(12, 2),
  closing_expected_amount numeric(12, 2),
  closing_difference_amount numeric(12, 2),
  closing_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (salon_id, session_date),
  check ((status = 'open' and closed_at is null) or status = 'closed'),
  check ((status = 'open' and closing_reported_amount is null) or status = 'closed'),
  check ((status = 'open' and closing_expected_amount is null) or status = 'closed'),
  check ((status = 'open' and closing_difference_amount is null) or status = 'closed')
);

create index if not exists salon_cash_sessions_salon_date_idx
on public.salon_cash_sessions (salon_id, session_date desc);

create or replace function public.touch_salon_cash_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_cash_sessions_touch_updated_at on public.salon_cash_sessions;

create trigger salon_cash_sessions_touch_updated_at
before update on public.salon_cash_sessions
for each row
execute function public.touch_salon_cash_sessions_updated_at();

alter table public.salon_cash_sessions enable row level security;

drop policy if exists "owners_manage_salon_cash_sessions" on public.salon_cash_sessions;

create policy "owners_manage_salon_cash_sessions"
on public.salon_cash_sessions
for all
using (
  exists (
    select 1
    from public.salons
    where salons.id = salon_cash_sessions.salon_id
      and salons.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.salons
    where salons.id = salon_cash_sessions.salon_id
      and salons.owner_user_id = auth.uid()
  )
);

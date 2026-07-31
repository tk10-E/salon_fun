create table if not exists public.salon_payables (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  category text not null check (char_length(btrim(category)) > 0),
  notes text,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text,
  due_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((status = 'paid' and paid_on is not null) or (status <> 'paid'))
);

create index if not exists salon_payables_salon_due_idx
on public.salon_payables (salon_id, status, due_on asc);

create or replace function public.touch_salon_payables_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_payables_touch_updated_at on public.salon_payables;

create trigger salon_payables_touch_updated_at
before update on public.salon_payables
for each row
execute function public.touch_salon_payables_updated_at();

alter table public.salon_payables enable row level security;

drop policy if exists "owners_manage_salon_payables" on public.salon_payables;

create policy "owners_manage_salon_payables"
on public.salon_payables
for all
using (
  exists (
    select 1
    from public.salons
    where salons.id = salon_payables.salon_id
      and salons.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.salons
    where salons.id = salon_payables.salon_id
      and salons.owner_user_id = auth.uid()
  )
);

alter table public.salon_financial_transactions
add column if not exists payable_id uuid references public.salon_payables (id) on delete set null;

alter table public.salon_financial_transactions
drop constraint if exists salon_financial_transactions_source_check;

alter table public.salon_financial_transactions
add constraint salon_financial_transactions_source_check
check (
  source in (
    'manual',
    'appointment',
    'store_order',
    'customer_tab',
    'team_payout',
    'recurring_expense',
    'payable'
  )
);

create index if not exists salon_financial_transactions_payable_idx
on public.salon_financial_transactions (salon_id, payable_id, occurred_on desc);

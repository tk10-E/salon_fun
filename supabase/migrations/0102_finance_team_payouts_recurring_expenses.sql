create table if not exists public.salon_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  category text not null check (char_length(btrim(category)) > 0),
  notes text,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text,
  cadence text not null default 'monthly' check (cadence in ('weekly', 'monthly', 'yearly')),
  next_due_on date not null default current_date,
  last_posted_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists salon_recurring_expenses_salon_due_idx
on public.salon_recurring_expenses (salon_id, is_active, next_due_on asc);

create or replace function public.touch_salon_recurring_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_recurring_expenses_touch_updated_at on public.salon_recurring_expenses;

create trigger salon_recurring_expenses_touch_updated_at
before update on public.salon_recurring_expenses
for each row
execute function public.touch_salon_recurring_expenses_updated_at();

alter table public.salon_recurring_expenses enable row level security;

drop policy if exists "owners_manage_salon_recurring_expenses" on public.salon_recurring_expenses;

create policy "owners_manage_salon_recurring_expenses"
on public.salon_recurring_expenses
for all
using (
  exists (
    select 1
    from public.salons
    where salons.id = salon_recurring_expenses.salon_id
      and salons.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.salons
    where salons.id = salon_recurring_expenses.salon_id
      and salons.owner_user_id = auth.uid()
  )
);

alter table public.salon_financial_transactions
add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

alter table public.salon_financial_transactions
add column if not exists recurring_expense_id uuid references public.salon_recurring_expenses (id) on delete set null;

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
    'recurring_expense'
  )
);

create index if not exists salon_financial_transactions_staff_member_idx
on public.salon_financial_transactions (salon_id, staff_member_id, occurred_on desc);

create index if not exists salon_financial_transactions_recurring_expense_idx
on public.salon_financial_transactions (salon_id, recurring_expense_id, occurred_on desc);

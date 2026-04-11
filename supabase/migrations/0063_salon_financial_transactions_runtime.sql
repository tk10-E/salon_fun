create table if not exists public.salon_financial_transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  store_order_id uuid references public.customer_product_orders (id) on delete set null,
  title text not null check (char_length(btrim(title)) > 0),
  category text not null check (char_length(btrim(category)) > 0),
  notes text,
  entry_type text not null check (entry_type in ('income', 'expense')),
  source text not null default 'manual' check (source in ('manual', 'appointment', 'store_order')),
  payment_method text,
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists salon_financial_transactions_salon_occurred_idx
on public.salon_financial_transactions (salon_id, occurred_on desc, created_at desc);

create index if not exists salon_financial_transactions_source_idx
on public.salon_financial_transactions (salon_id, source, entry_type, occurred_on desc);

create or replace function public.touch_salon_financial_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_financial_transactions_touch_updated_at on public.salon_financial_transactions;

create trigger salon_financial_transactions_touch_updated_at
before update on public.salon_financial_transactions
for each row
execute function public.touch_salon_financial_transactions_updated_at();

alter table public.salon_financial_transactions enable row level security;

drop policy if exists "owners_manage_salon_financial_transactions" on public.salon_financial_transactions;

create policy "owners_manage_salon_financial_transactions"
on public.salon_financial_transactions
for all
using (
  exists (
    select 1
    from public.salons
    where salons.id = salon_financial_transactions.salon_id
      and salons.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.salons
    where salons.id = salon_financial_transactions.salon_id
      and salons.owner_user_id = auth.uid()
  )
);

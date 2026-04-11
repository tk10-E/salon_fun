-- Comandas digitais, CRM avançado e pagamentos parciais

create table if not exists public.customer_tabs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  opened_by uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  notes text,
  total_items numeric(12, 2) not null default 0,
  total_paid numeric(12, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_tabs_salon_status_idx on public.customer_tabs (salon_id, status, opened_at desc);

create table if not exists public.customer_tab_items (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.customer_tabs (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  inventory_product_id uuid references public.inventory_products (id) on delete set null,
  description text not null check (char_length(btrim(description)) > 0),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_tab_items_tab_idx on public.customer_tab_items (tab_id, created_at desc);

create table if not exists public.customer_tab_payments (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.customer_tabs (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'pix', 'voucher', 'transfer', 'other')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_tab_payments_tab_idx on public.customer_tab_payments (tab_id, created_at desc);

-- CRM avançado: tags, preferências e aniversário
alter table public.customers
  add column if not exists tags text[] not null default '{}',
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists birthday date,
  add column if not exists notes text;

-- Atualiza totals em customer_tabs
create or replace function public.refresh_customer_tab_totals()
returns trigger
language plpgsql
as $$
declare
  v_tab uuid;
begin
  v_tab := coalesce(new.tab_id, old.tab_id);

  update public.customer_tabs t
  set total_items = coalesce((select sum(total) from public.customer_tab_items where tab_id = v_tab), 0),
      total_paid  = coalesce((select sum(amount) from public.customer_tab_payments where tab_id = v_tab), 0),
      updated_at = timezone('utc', now())
  where t.id = v_tab;

  return null;
end;
$$;

drop trigger if exists customer_tab_items_refresh_totals on public.customer_tab_items;
create trigger customer_tab_items_refresh_totals
after insert or update or delete on public.customer_tab_items
for each row execute function public.refresh_customer_tab_totals();

drop trigger if exists customer_tab_payments_refresh_totals on public.customer_tab_payments;
create trigger customer_tab_payments_refresh_totals
after insert or update or delete on public.customer_tab_payments
for each row execute function public.refresh_customer_tab_totals();

-- updated_at touch trigger on tabs
create or replace function public.touch_customer_tabs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_tabs_touch_updated_at on public.customer_tabs;
create trigger customer_tabs_touch_updated_at
before update on public.customer_tabs
for each row execute function public.touch_customer_tabs_updated_at();

-- RLS
alter table public.customer_tabs enable row level security;
alter table public.customer_tab_items enable row level security;
alter table public.customer_tab_payments enable row level security;

drop policy if exists "owners_manage_customer_tabs" on public.customer_tabs;
create policy "owners_manage_customer_tabs"
on public.customer_tabs
for all
using (
  exists (
    select 1 from public.salons s
    where s.id = customer_tabs.salon_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.salons s
    where s.id = customer_tabs.salon_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "owners_manage_customer_tab_items" on public.customer_tab_items;
create policy "owners_manage_customer_tab_items"
on public.customer_tab_items
for all
using (
  exists (
    select 1 from public.salons s
    where s.id = customer_tab_items.salon_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.salons s
    where s.id = customer_tab_items.salon_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "owners_manage_customer_tab_payments" on public.customer_tab_payments;
create policy "owners_manage_customer_tab_payments"
on public.customer_tab_payments
for all
using (
  exists (
    select 1 from public.salons s
    where s.id = customer_tab_payments.salon_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.salons s
    where s.id = customer_tab_payments.salon_id
      and s.owner_user_id = auth.uid()
  )
);

-- Sincroniza totais existentes
update public.customer_tabs t
set total_items = coalesce((select sum(total) from public.customer_tab_items where tab_id = t.id), 0),
    total_paid  = coalesce((select sum(amount) from public.customer_tab_payments where tab_id = t.id), 0),
    updated_at = timezone('utc', now());

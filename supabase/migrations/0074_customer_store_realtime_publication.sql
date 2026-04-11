drop policy if exists "customers_read_storefront_inventory_products" on public.inventory_products;

create policy "customers_read_storefront_inventory_products"
on public.inventory_products
for select
to authenticated
using (
  salon_id = public.current_customer_salon_id()
  and is_active
  and coalesce(current_stock, 0) > 0
  and coalesce(retail_price, 0) > 0
);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_products'
  ) then
    alter publication supabase_realtime add table public.inventory_products;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_product_orders'
  ) then
    alter publication supabase_realtime add table public.customer_product_orders;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_product_order_items'
  ) then
    alter publication supabase_realtime add table public.customer_product_order_items;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;

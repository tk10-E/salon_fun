create or replace function public.get_customer_product_catalog(limit_count integer default 24)
returns table (
  id uuid,
  name text,
  brand text,
  retail_price numeric,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    product.id,
    product.name,
    product.brand,
    product.retail_price,
    product.updated_at
  from public.inventory_products as product
  where product.salon_id = public.current_customer_salon_id()
    and product.is_active
    and coalesce(product.current_stock, 0) > 0
    and coalesce(product.retail_price, 0) > 0
  order by product.updated_at desc, product.name asc
  limit greatest(least(coalesce(limit_count, 24), 60), 1);
$$;

grant execute on function public.get_customer_product_catalog(integer) to authenticated;

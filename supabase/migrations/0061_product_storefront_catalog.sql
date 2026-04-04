alter table public.inventory_products
add column if not exists description text,
add column if not exists image_paths text[] not null default '{}'::text[],
add column if not exists max_purchase_quantity integer not null default 6;

alter table public.inventory_products
drop constraint if exists inventory_products_description_check;

alter table public.inventory_products
add constraint inventory_products_description_check
check (
  description is null
  or char_length(btrim(description)) between 1 and 1200
);

alter table public.inventory_products
drop constraint if exists inventory_products_image_paths_limit_check;

alter table public.inventory_products
add constraint inventory_products_image_paths_limit_check
check (
  coalesce(array_length(image_paths, 1), 0) between 0 and 6
);

alter table public.inventory_products
drop constraint if exists inventory_products_max_purchase_quantity_check;

alter table public.inventory_products
add constraint inventory_products_max_purchase_quantity_check
check (max_purchase_quantity between 1 and 99);

update public.inventory_products
set image_paths = '{}'::text[]
where image_paths is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-products',
  'inventory-products',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owners_read_their_inventory_product_media" on storage.objects;
drop policy if exists "owners_upload_their_inventory_product_media" on storage.objects;
drop policy if exists "owners_update_their_inventory_product_media" on storage.objects;
drop policy if exists "owners_delete_their_inventory_product_media" on storage.objects;

create policy "owners_read_their_inventory_product_media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inventory-products'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_upload_their_inventory_product_media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inventory-products'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_update_their_inventory_product_media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'inventory-products'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
)
with check (
  bucket_id = 'inventory-products'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_delete_their_inventory_product_media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inventory-products'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

drop function if exists public.get_customer_product_catalog(integer);

create or replace function public.get_customer_product_catalog(limit_count integer default 24)
returns table (
  id uuid,
  name text,
  brand text,
  description text,
  retail_price numeric,
  current_stock numeric,
  unit text,
  max_purchase_quantity integer,
  image_paths text[],
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
    product.description,
    product.retail_price,
    product.current_stock,
    product.unit,
    product.max_purchase_quantity,
    coalesce(product.image_paths, '{}'::text[]) as image_paths,
    product.updated_at
  from public.inventory_products as product
  where product.salon_id = public.current_customer_salon_id()
    and product.is_active
    and coalesce(product.current_stock, 0) > 0
    and coalesce(product.retail_price, 0) > 0
  order by
    coalesce(array_length(product.image_paths, 1), 0) desc,
    product.updated_at desc,
    product.name asc
  limit greatest(least(coalesce(limit_count, 24), 60), 1);
$$;

grant execute on function public.get_customer_product_catalog(integer) to authenticated;

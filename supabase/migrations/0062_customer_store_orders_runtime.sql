create table if not exists public.customer_product_orders (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_number bigint generated always as identity,
  status text not null default 'pending',
  source text not null default 'client_app',
  total_items integer not null default 0,
  subtotal_amount numeric(10, 2) not null default 0,
  notes text,
  cancellation_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  check (status in ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  check (source in ('client_app', 'owner_panel')),
  check (total_items >= 0),
  check (subtotal_amount >= 0),
  check (notes is null or char_length(btrim(notes)) between 1 and 500),
  check (
    cancellation_reason is null
    or char_length(btrim(cancellation_reason)) between 1 and 240
  )
);

create index if not exists customer_product_orders_salon_idx
on public.customer_product_orders (salon_id, status, created_at desc);

create index if not exists customer_product_orders_customer_idx
on public.customer_product_orders (customer_id, created_at desc);

create or replace function public.touch_customer_product_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_product_orders_touch_updated_at on public.customer_product_orders;

create trigger customer_product_orders_touch_updated_at
before update on public.customer_product_orders
for each row
execute function public.touch_customer_product_orders_updated_at();

alter table public.customer_product_orders enable row level security;

drop policy if exists "owners_manage_customer_product_orders" on public.customer_product_orders;
drop policy if exists "customers_read_own_product_orders" on public.customer_product_orders;

create policy "owners_manage_customer_product_orders"
on public.customer_product_orders
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_product_orders"
on public.customer_product_orders
for select
to authenticated
using (customer_id = public.current_customer_id());

create table if not exists public.customer_product_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_product_orders (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_id uuid references public.inventory_products (id) on delete set null,
  product_name_snapshot text not null,
  product_brand_snapshot text,
  product_image_path text,
  unit_snapshot text not null default 'un',
  quantity integer not null,
  unit_price_snapshot numeric(10, 2) not null,
  line_total_amount numeric(10, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(product_name_snapshot)) between 1 and 120),
  check (
    product_brand_snapshot is null
    or char_length(btrim(product_brand_snapshot)) between 1 and 120
  ),
  check (product_image_path is null or char_length(btrim(product_image_path)) between 1 and 500),
  check (char_length(btrim(unit_snapshot)) between 1 and 20),
  check (quantity between 1 and 99),
  check (unit_price_snapshot >= 0),
  check (line_total_amount >= 0)
);

create index if not exists customer_product_order_items_order_idx
on public.customer_product_order_items (order_id, created_at asc);

create index if not exists customer_product_order_items_customer_idx
on public.customer_product_order_items (customer_id, created_at desc);

create or replace function public.ensure_customer_product_order_item_matches_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  related_order record;
begin
  select order_header.salon_id, order_header.customer_id
  into related_order
  from public.customer_product_orders as order_header
  where order_header.id = new.order_id;

  if related_order is null then
    raise exception 'customer_product_order_not_found';
  end if;

  if related_order.salon_id <> new.salon_id then
    raise exception 'customer_product_order_item_salon_mismatch';
  end if;

  if related_order.customer_id <> new.customer_id then
    raise exception 'customer_product_order_item_customer_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_product_order_items_match_context on public.customer_product_order_items;

create trigger customer_product_order_items_match_context
before insert or update of order_id, salon_id, customer_id
on public.customer_product_order_items
for each row
execute function public.ensure_customer_product_order_item_matches_context();

alter table public.customer_product_order_items enable row level security;

drop policy if exists "owners_manage_customer_product_order_items" on public.customer_product_order_items;
drop policy if exists "customers_read_own_product_order_items" on public.customer_product_order_items;

create policy "owners_manage_customer_product_order_items"
on public.customer_product_order_items
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_product_order_items"
on public.customer_product_order_items
for select
to authenticated
using (customer_id = public.current_customer_id());

create or replace function public.create_customer_product_order(
  items_input jsonb,
  notes_input text default null
)
returns table (
  order_id uuid,
  order_number bigint,
  status text,
  total_items integer,
  subtotal_amount numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_customer_id uuid;
  customer_salon_id uuid;
  requested_item jsonb;
  requested_product_id uuid;
  requested_quantity integer;
  target_product public.inventory_products;
  created_order public.customer_product_orders;
  cleaned_notes text := nullif(btrim(notes_input), '');
  order_subtotal numeric(10, 2) := 0;
  order_total_items integer := 0;
  line_total_value numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  authenticated_customer_id := public.current_customer_id();
  customer_salon_id := public.current_customer_salon_id();

  if authenticated_customer_id is null or customer_salon_id is null then
    raise exception 'customer_not_found';
  end if;

  if cleaned_notes is not null and char_length(cleaned_notes) > 500 then
    raise exception 'product_order_notes_too_long';
  end if;

  if jsonb_typeof(items_input) <> 'array' or jsonb_array_length(items_input) = 0 then
    raise exception 'empty_product_order';
  end if;

  insert into public.customer_product_orders (
    salon_id,
    customer_id,
    status,
    source,
    notes
  )
  values (
    customer_salon_id,
    authenticated_customer_id,
    'pending',
    'client_app',
    cleaned_notes
  )
  returning *
  into created_order;

  for requested_item in
    select value
    from jsonb_array_elements(items_input)
  loop
    if jsonb_typeof(requested_item) <> 'object' then
      raise exception 'invalid_product_order_payload';
    end if;

    requested_product_id := nullif(btrim(requested_item ->> 'product_id'), '')::uuid;
    requested_quantity := coalesce((requested_item ->> 'quantity')::integer, 0);

    if requested_product_id is null or requested_quantity < 1 or requested_quantity > 99 then
      raise exception 'invalid_product_order_item';
    end if;

    select *
    into target_product
    from public.inventory_products
    where id = requested_product_id
      and salon_id = customer_salon_id
      and is_active
      and coalesce(retail_price, 0) > 0
    for update;

    if target_product.id is null then
      raise exception 'inventory_product_not_found';
    end if;

    if requested_quantity > coalesce(target_product.max_purchase_quantity, 0) then
      raise exception 'inventory_product_purchase_limit_exceeded';
    end if;

    if coalesce(target_product.current_stock, 0) < requested_quantity then
      raise exception 'inventory_product_insufficient_stock';
    end if;

    line_total_value := target_product.retail_price * requested_quantity;

    update public.inventory_products
    set current_stock = current_stock - requested_quantity
    where id = target_product.id;

    insert into public.customer_product_order_items (
      order_id,
      salon_id,
      customer_id,
      product_id,
      product_name_snapshot,
      product_brand_snapshot,
      product_image_path,
      unit_snapshot,
      quantity,
      unit_price_snapshot,
      line_total_amount
    )
    values (
      created_order.id,
      customer_salon_id,
      authenticated_customer_id,
      target_product.id,
      target_product.name,
      target_product.brand,
      coalesce(target_product.image_paths[1], null),
      target_product.unit,
      requested_quantity,
      target_product.retail_price,
      line_total_value
    );

    insert into public.inventory_movements (
      salon_id,
      product_id,
      movement_type,
      quantity,
      previous_stock,
      resulting_stock,
      reason
    )
    values (
      customer_salon_id,
      target_product.id,
      'out',
      requested_quantity,
      target_product.current_stock,
      target_product.current_stock - requested_quantity,
      format('Pedido loja #%s enviado pelo app', created_order.order_number)
    );

    order_subtotal := order_subtotal + line_total_value;
    order_total_items := order_total_items + requested_quantity;
  end loop;

  update public.customer_product_orders
  set
    total_items = order_total_items,
    subtotal_amount = order_subtotal
  where id = created_order.id
  returning *
  into created_order;

  return query
  select
    created_order.id,
    created_order.order_number,
    created_order.status,
    created_order.total_items,
    created_order.subtotal_amount,
    created_order.created_at;
end;
$$;

grant execute on function public.create_customer_product_order(jsonb, text) to authenticated;

create or replace function public.update_customer_product_order_status(
  order_id_input uuid,
  status_input text,
  cancellation_reason_input text default null
)
returns table (
  order_id uuid,
  order_number bigint,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  normalized_status text := lower(btrim(coalesce(status_input, '')));
  cleaned_cancellation_reason text := nullif(btrim(cancellation_reason_input), '');
  target_order public.customer_product_orders;
  order_item record;
  previous_stock_value numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  if normalized_status not in ('pending', 'confirmed', 'ready', 'completed', 'cancelled') then
    raise exception 'invalid_product_order_status';
  end if;

  select *
  into target_order
  from public.customer_product_orders
  where id = order_id_input
    and salon_id = owner_salon_id
  for update;

  if target_order.id is null then
    raise exception 'product_order_not_found';
  end if;

  if target_order.status = 'completed' and normalized_status <> 'completed' then
    raise exception 'completed_product_order_cannot_change_status';
  end if;

  if target_order.status = 'cancelled' and normalized_status <> 'cancelled' then
    raise exception 'cancelled_product_order_cannot_change_status';
  end if;

  if normalized_status = 'cancelled' and cleaned_cancellation_reason is null then
    raise exception 'product_order_cancellation_reason_required';
  end if;

  if normalized_status = target_order.status then
    return query
    select
      target_order.id,
      target_order.order_number,
      target_order.status,
      target_order.updated_at;
    return;
  end if;

  if normalized_status = 'cancelled' then
    for order_item in
      select *
      from public.customer_product_order_items
      where order_id = target_order.id
        and product_id is not null
    loop
      select current_stock
      into previous_stock_value
      from public.inventory_products
      where id = order_item.product_id
      for update;

      if previous_stock_value is null then
        continue;
      end if;

      update public.inventory_products
      set current_stock = current_stock + order_item.quantity
      where id = order_item.product_id;

      insert into public.inventory_movements (
        salon_id,
        product_id,
        movement_type,
        quantity,
        previous_stock,
        resulting_stock,
        reason
      )
      values (
        owner_salon_id,
        order_item.product_id,
        'in',
        order_item.quantity,
        previous_stock_value,
        previous_stock_value + order_item.quantity,
        format('Pedido loja #%s cancelado pelo salão', target_order.order_number)
      );
    end loop;
  end if;

  update public.customer_product_orders
  set
    status = normalized_status,
    confirmed_at = case
      when normalized_status in ('confirmed', 'ready', 'completed')
        then coalesce(confirmed_at, timezone('utc', now()))
      else confirmed_at
    end,
    ready_at = case
      when normalized_status in ('ready', 'completed')
        then coalesce(ready_at, timezone('utc', now()))
      else ready_at
    end,
    completed_at = case
      when normalized_status = 'completed'
        then coalesce(completed_at, timezone('utc', now()))
      else completed_at
    end,
    cancelled_at = case
      when normalized_status = 'cancelled'
        then coalesce(cancelled_at, timezone('utc', now()))
      else cancelled_at
    end,
    cancellation_reason = case
      when normalized_status = 'cancelled' then cleaned_cancellation_reason
      else cancellation_reason
    end
  where id = target_order.id
  returning *
  into target_order;

  return query
  select
    target_order.id,
    target_order.order_number,
    target_order.status,
    target_order.updated_at;
end;
$$;

grant execute on function public.update_customer_product_order_status(uuid, text, text)
to authenticated;

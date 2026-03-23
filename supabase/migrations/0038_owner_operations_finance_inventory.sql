alter table public.staff_members
add column if not exists commission_rate_percent numeric(5, 2) not null default 0,
add column if not exists commission_flat_fee numeric(10, 2) not null default 0;

alter table public.staff_members
drop constraint if exists staff_members_commission_rate_percent_check,
drop constraint if exists staff_members_commission_flat_fee_check;

alter table public.staff_members
add constraint staff_members_commission_rate_percent_check
check (commission_rate_percent between 0 and 100),
add constraint staff_members_commission_flat_fee_check
check (commission_flat_fee >= 0);

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_owner_salon_id() references public.salons (id) on delete cascade,
  name text not null,
  brand text,
  sku text,
  unit text not null default 'un',
  current_stock numeric(10, 2) not null default 0,
  minimum_stock numeric(10, 2) not null default 0,
  cost_price numeric(10, 2),
  retail_price numeric(10, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(name)) between 1 and 120),
  check (brand is null or char_length(btrim(brand)) between 1 and 120),
  check (sku is null or char_length(btrim(sku)) between 1 and 60),
  check (char_length(btrim(unit)) between 1 and 20),
  check (current_stock >= 0),
  check (minimum_stock >= 0),
  check (cost_price is null or cost_price >= 0),
  check (retail_price is null or retail_price >= 0)
);

create index if not exists inventory_products_salon_idx
on public.inventory_products (salon_id, is_active, name);

create index if not exists inventory_products_low_stock_idx
on public.inventory_products (salon_id, is_active, current_stock, minimum_stock);

create or replace function public.touch_inventory_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists inventory_products_touch_updated_at on public.inventory_products;

create trigger inventory_products_touch_updated_at
before update on public.inventory_products
for each row
execute function public.touch_inventory_products_updated_at();

alter table public.inventory_products enable row level security;

drop policy if exists "owners_manage_inventory_products" on public.inventory_products;

create policy "owners_manage_inventory_products"
on public.inventory_products
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_owner_salon_id() references public.salons (id) on delete cascade,
  product_id uuid not null references public.inventory_products (id) on delete cascade,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity numeric(10, 2) not null,
  previous_stock numeric(10, 2) not null,
  resulting_stock numeric(10, 2) not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  check (quantity >= 0),
  check (previous_stock >= 0),
  check (resulting_stock >= 0),
  check (reason is null or char_length(btrim(reason)) between 1 and 240)
);

create index if not exists inventory_movements_salon_idx
on public.inventory_movements (salon_id, created_at desc);

create index if not exists inventory_movements_product_idx
on public.inventory_movements (product_id, created_at desc);

create or replace function public.ensure_inventory_movement_matches_salon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  product_salon_id uuid;
  staff_salon_id uuid;
begin
  select salon_id
  into product_salon_id
  from public.inventory_products
  where id = new.product_id;

  if product_salon_id is null then
    raise exception 'inventory_product_not_found';
  end if;

  if product_salon_id <> new.salon_id then
    raise exception 'inventory_product_must_belong_to_same_salon';
  end if;

  if new.staff_member_id is not null then
    select salon_id
    into staff_salon_id
    from public.staff_members
    where id = new.staff_member_id;

    if staff_salon_id is null or staff_salon_id <> new.salon_id then
      raise exception 'inventory_staff_member_must_belong_to_same_salon';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_movements_match_salon on public.inventory_movements;

create trigger inventory_movements_match_salon
before insert or update of salon_id, product_id, staff_member_id
on public.inventory_movements
for each row
execute function public.ensure_inventory_movement_matches_salon();

alter table public.inventory_movements enable row level security;

drop policy if exists "owners_manage_inventory_movements" on public.inventory_movements;

create policy "owners_manage_inventory_movements"
on public.inventory_movements
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create or replace function public.register_inventory_movement(
  product_id_input uuid,
  movement_type_input text,
  quantity_input numeric,
  reason_input text default null,
  staff_member_id_input uuid default null
)
returns public.inventory_products
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  normalized_movement_type text := lower(btrim(coalesce(movement_type_input, '')));
  target_product public.inventory_products;
  previous_stock_value numeric(10, 2);
  resulting_stock_value numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  if quantity_input is null or quantity_input < 0 then
    raise exception 'invalid_inventory_quantity';
  end if;

  select *
  into target_product
  from public.inventory_products
  where id = product_id_input
    and salon_id = owner_salon_id
  for update;

  if target_product.id is null then
    raise exception 'inventory_product_not_found';
  end if;

  previous_stock_value := target_product.current_stock;

  if normalized_movement_type = 'in' then
    resulting_stock_value := previous_stock_value + quantity_input;
  elsif normalized_movement_type = 'out' then
    if quantity_input > previous_stock_value then
      raise exception 'insufficient_inventory_stock';
    end if;

    resulting_stock_value := previous_stock_value - quantity_input;
  elsif normalized_movement_type = 'adjustment' then
    resulting_stock_value := quantity_input;
  else
    raise exception 'invalid_inventory_movement_type';
  end if;

  update public.inventory_products
  set current_stock = resulting_stock_value
  where id = target_product.id;

  insert into public.inventory_movements (
    salon_id,
    product_id,
    staff_member_id,
    movement_type,
    quantity,
    previous_stock,
    resulting_stock,
    reason
  )
  values (
    owner_salon_id,
    target_product.id,
    staff_member_id_input,
    normalized_movement_type,
    quantity_input,
    previous_stock_value,
    resulting_stock_value,
    nullif(btrim(reason_input), '')
  );

  select *
  into target_product
  from public.inventory_products
  where id = target_product.id;

  return target_product;
end;
$$;

grant execute on function public.register_inventory_movement(uuid, text, numeric, text, uuid)
to authenticated;

create or replace function public.get_owner_operations_dashboard(
  days_input integer default 7,
  top_staff_limit_input integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner_salon public.salons;
  owner_timezone text := 'America/Sao_Paulo';
  safe_days integer := least(greatest(coalesce(days_input, 7), 3), 31);
  safe_top_staff_limit integer := least(greatest(coalesce(top_staff_limit_input, 5), 1), 12);
  payload jsonb := jsonb_build_object(
    'overview',
    jsonb_build_object(
      'total_revenue', 0,
      'average_ticket', 0,
      'estimated_commissions', 0,
      'low_stock_products', 0,
      'active_inventory_products', 0,
      'active_staff_members', 0,
      'top_staff_name', null,
      'top_staff_revenue', 0
    ),
    'daily_revenue', '[]'::jsonb,
    'top_staff', '[]'::jsonb,
    'staff_agenda', '[]'::jsonb
  );
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where id = public.current_owner_salon_id();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  owner_timezone := coalesce(owner_salon.timezone, owner_timezone);

  with completed_appointments as (
    select
      appointment.id,
      appointment.staff_member_id,
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as completed_reference_at,
      service.price::numeric(10, 2) as service_price
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
      and appointment.status::text = 'completed'
      and coalesce(appointment.completed_at, appointment.ends_at, appointment.date)
        >= timezone('utc', now()) - make_interval(days => safe_days - 1)
  ),
  all_completed_appointments as (
    select
      appointment.id,
      appointment.staff_member_id,
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as completed_reference_at,
      service.price::numeric(10, 2) as service_price
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
      and appointment.status::text = 'completed'
  ),
  day_series as (
    select generate_series(
      (timezone('utc', now()) at time zone owner_timezone)::date - (safe_days - 1),
      (timezone('utc', now()) at time zone owner_timezone)::date,
      interval '1 day'
    )::date as revenue_day
  ),
  daily_revenue_rows as (
    select
      day_series.revenue_day,
      coalesce(count(completed_appointments.id), 0)::integer as completed_appointments,
      coalesce(sum(completed_appointments.service_price), 0)::numeric(10, 2) as total_revenue
    from day_series
    left join completed_appointments
      on (completed_appointments.completed_reference_at at time zone owner_timezone)::date = day_series.revenue_day
    group by day_series.revenue_day
    order by day_series.revenue_day asc
  ),
  upcoming_appointments as (
    select
      appointment.staff_member_id,
      count(*) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )::integer as upcoming_appointments,
      count(*) filter (
        where appointment.status::text = 'pending'
          and appointment.date >= timezone('utc', now())
      )::integer as pending_appointments,
      min(appointment.date) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      ) as next_appointment_at
    from public.appointments appointment
    where appointment.salon_id = owner_salon.id
    group by appointment.staff_member_id
  ),
  staff_services as (
    select
      assignment.staff_member_id,
      count(*)::integer as assigned_services
    from public.staff_service_assignments assignment
    group by assignment.staff_member_id
  ),
  staff_base as (
    select
      staff_member.id,
      staff_member.name,
      staff_member.role,
      staff_member.is_active,
      coalesce(staff_member.commission_rate_percent, 0)::numeric(5, 2) as commission_rate_percent,
      coalesce(staff_member.commission_flat_fee, 0)::numeric(10, 2) as commission_flat_fee,
      coalesce(staff_services.assigned_services, 0)::integer as assigned_services,
      coalesce(upcoming_appointments.upcoming_appointments, 0)::integer as upcoming_appointments,
      coalesce(upcoming_appointments.pending_appointments, 0)::integer as pending_appointments,
      upcoming_appointments.next_appointment_at,
      coalesce(count(all_completed_appointments.id), 0)::integer as completed_appointments,
      coalesce(sum(all_completed_appointments.service_price), 0)::numeric(10, 2) as total_revenue,
      coalesce(sum(all_completed_appointments.service_price), 0)::numeric(10, 2)
        * (coalesce(staff_member.commission_rate_percent, 0)::numeric(5, 2) / 100)
        + coalesce(count(all_completed_appointments.id), 0)::numeric(10, 2)
        * coalesce(staff_member.commission_flat_fee, 0)::numeric(10, 2) as estimated_commission
    from public.staff_members staff_member
    left join all_completed_appointments
      on all_completed_appointments.staff_member_id = staff_member.id
    left join upcoming_appointments
      on upcoming_appointments.staff_member_id = staff_member.id
    left join staff_services
      on staff_services.staff_member_id = staff_member.id
    where staff_member.salon_id = owner_salon.id
    group by
      staff_member.id,
      staff_member.name,
      staff_member.role,
      staff_member.is_active,
      staff_member.commission_rate_percent,
      staff_member.commission_flat_fee,
      staff_services.assigned_services,
      upcoming_appointments.upcoming_appointments,
      upcoming_appointments.pending_appointments,
      upcoming_appointments.next_appointment_at
  ),
  top_staff_rows as (
    select *
    from staff_base
    order by total_revenue desc, completed_appointments desc, name asc
    limit safe_top_staff_limit
  ),
  inventory_overview as (
    select
      count(*) filter (where is_active)::integer as active_inventory_products,
      count(*) filter (
        where is_active
          and current_stock <= minimum_stock
      )::integer as low_stock_products
    from public.inventory_products
    where salon_id = owner_salon.id
  ),
  revenue_overview as (
    select
      coalesce(sum(service_price), 0)::numeric(10, 2) as total_revenue,
      coalesce(avg(service_price), 0)::numeric(10, 2) as average_ticket
    from completed_appointments
  ),
  staff_overview as (
    select
      count(*) filter (where is_active)::integer as active_staff_members,
      coalesce(sum(estimated_commission), 0)::numeric(10, 2) as estimated_commissions
    from staff_base
  ),
  top_staff_overview as (
    select
      name as top_staff_name,
      total_revenue as top_staff_revenue
    from top_staff_rows
    order by total_revenue desc, completed_appointments desc, name asc
    limit 1
  )
  select jsonb_build_object(
    'overview',
    jsonb_build_object(
      'total_revenue', coalesce((select total_revenue from revenue_overview), 0),
      'average_ticket', coalesce((select average_ticket from revenue_overview), 0),
      'estimated_commissions', coalesce((select estimated_commissions from staff_overview), 0),
      'low_stock_products', coalesce((select low_stock_products from inventory_overview), 0),
      'active_inventory_products', coalesce((select active_inventory_products from inventory_overview), 0),
      'active_staff_members', coalesce((select active_staff_members from staff_overview), 0),
      'top_staff_name', (select top_staff_name from top_staff_overview),
      'top_staff_revenue', coalesce((select top_staff_revenue from top_staff_overview), 0)
    ),
    'daily_revenue',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', row.revenue_day,
            'completed_appointments', row.completed_appointments,
            'total_revenue', row.total_revenue
          )
          order by row.revenue_day asc
        )
        from daily_revenue_rows row
      ),
      '[]'::jsonb
    ),
    'top_staff',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', row.id,
            'name', row.name,
            'role', row.role,
            'is_active', row.is_active,
            'completed_appointments', row.completed_appointments,
            'total_revenue', row.total_revenue,
            'estimated_commission', row.estimated_commission,
            'commission_rate_percent', row.commission_rate_percent,
            'commission_flat_fee', row.commission_flat_fee,
            'upcoming_appointments', row.upcoming_appointments,
            'pending_appointments', row.pending_appointments,
            'next_appointment_at', row.next_appointment_at,
            'assigned_services', row.assigned_services
          )
          order by row.total_revenue desc, row.completed_appointments desc, row.name asc
        )
        from top_staff_rows row
      ),
      '[]'::jsonb
    ),
    'staff_agenda',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', row.id,
            'name', row.name,
            'role', row.role,
            'is_active', row.is_active,
            'assigned_services', row.assigned_services,
            'upcoming_appointments', row.upcoming_appointments,
            'pending_appointments', row.pending_appointments,
            'next_appointment_at', row.next_appointment_at,
            'commission_rate_percent', row.commission_rate_percent,
            'commission_flat_fee', row.commission_flat_fee
          )
          order by row.is_active desc, row.upcoming_appointments desc, row.name asc
        )
        from staff_base row
      ),
      '[]'::jsonb
    )
  )
  into payload;

  return payload;
end;
$$;

grant execute on function public.get_owner_operations_dashboard(integer, integer)
to authenticated;

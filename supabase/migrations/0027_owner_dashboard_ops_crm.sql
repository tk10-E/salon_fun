create or replace function public.get_owner_appointment_board(
  search_input text default null,
  date_from_input date default null,
  date_to_input date default null,
  staff_member_id_input uuid default null,
  board_status_input text default null,
  page_input integer default 1,
  page_size_input integer default 20
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
  normalized_search text := nullif(btrim(coalesce(search_input, '')), '');
  normalized_board_status text := lower(nullif(btrim(coalesce(board_status_input, '')), ''));
  safe_page integer := greatest(coalesce(page_input, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size_input, 20), 1), 50);
  effective_page integer := 1;
  total_count integer := 0;
  total_pages integer := 1;
  items jsonb := '[]'::jsonb;
  overview jsonb := jsonb_build_object(
    'pending', 0,
    'confirmed', 0,
    'awaiting_completion', 0,
    'completed', 0,
    'cancelled', 0
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

  if normalized_board_status not in (
    'pending',
    'confirmed',
    'awaiting-completion',
    'completed',
    'cancelled'
  ) then
    normalized_board_status := null;
  end if;

  with base as (
    select
      appointment.id,
      appointment.cancellation_reason,
      appointment.cancelled_at,
      appointment.cancelled_by,
      appointment.completed_at,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      appointment.date,
      appointment.ends_at,
      appointment.status::text as status,
      customer.name as customer_name,
      service.category as service_category,
      service.name as service_name,
      service.duration as service_duration,
      staff_member.name as staff_member_name,
      case
        when appointment.status::text = 'cancelled' then 'cancelled'
        when appointment.status::text = 'completed' then 'completed'
        when appointment.status::text = 'confirmed'
          and appointment.ends_at <= timezone('utc', now()) then 'awaiting-completion'
        when appointment.status::text = 'confirmed' then 'confirmed'
        else 'pending'
      end as board_status
    from public.appointments appointment
    join public.customers customer
      on customer.id = appointment.customer_id
    join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.salon_id = owner_salon.id
      and (
        staff_member_id_input is null
        or appointment.staff_member_id = staff_member_id_input
      )
      and (
        date_from_input is null
        or (appointment.date at time zone owner_timezone)::date >= date_from_input
      )
      and (
        date_to_input is null
        or (appointment.date at time zone owner_timezone)::date <= date_to_input
      )
      and (
        normalized_search is null
        or customer.name ilike '%' || normalized_search || '%'
        or service.name ilike '%' || normalized_search || '%'
        or coalesce(service.category, '') ilike '%' || normalized_search || '%'
        or coalesce(staff_member.name, '') ilike '%' || normalized_search || '%'
      )
  )
  select jsonb_build_object(
    'pending', count(*) filter (where board_status = 'pending'),
    'confirmed', count(*) filter (where board_status = 'confirmed'),
    'awaiting_completion', count(*) filter (where board_status = 'awaiting-completion'),
    'completed', count(*) filter (where board_status = 'completed'),
    'cancelled', count(*) filter (where board_status = 'cancelled')
  )
  into overview
  from base;

  with base as (
    select
      appointment.id,
      appointment.cancellation_reason,
      appointment.cancelled_at,
      appointment.cancelled_by,
      appointment.completed_at,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      appointment.date,
      appointment.ends_at,
      appointment.status::text as status,
      customer.name as customer_name,
      service.category as service_category,
      service.name as service_name,
      service.duration as service_duration,
      staff_member.name as staff_member_name,
      case
        when appointment.status::text = 'cancelled' then 'cancelled'
        when appointment.status::text = 'completed' then 'completed'
        when appointment.status::text = 'confirmed'
          and appointment.ends_at <= timezone('utc', now()) then 'awaiting-completion'
        when appointment.status::text = 'confirmed' then 'confirmed'
        else 'pending'
      end as board_status
    from public.appointments appointment
    join public.customers customer
      on customer.id = appointment.customer_id
    join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.salon_id = owner_salon.id
      and (
        staff_member_id_input is null
        or appointment.staff_member_id = staff_member_id_input
      )
      and (
        date_from_input is null
        or (appointment.date at time zone owner_timezone)::date >= date_from_input
      )
      and (
        date_to_input is null
        or (appointment.date at time zone owner_timezone)::date <= date_to_input
      )
      and (
        normalized_search is null
        or customer.name ilike '%' || normalized_search || '%'
        or service.name ilike '%' || normalized_search || '%'
        or coalesce(service.category, '') ilike '%' || normalized_search || '%'
        or coalesce(staff_member.name, '') ilike '%' || normalized_search || '%'
      )
  ),
  filtered as (
    select *
    from base
    where normalized_board_status is null
       or board_status = normalized_board_status
  )
  select count(*)
  into total_count
  from filtered;

  total_pages := greatest(ceil(greatest(total_count, 1)::numeric / safe_page_size)::integer, 1);
  effective_page := least(safe_page, total_pages);

  with base as (
    select
      appointment.id,
      appointment.cancellation_reason,
      appointment.cancelled_at,
      appointment.cancelled_by,
      appointment.completed_at,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      appointment.date,
      appointment.ends_at,
      appointment.status::text as status,
      customer.name as customer_name,
      service.category as service_category,
      service.name as service_name,
      service.duration as service_duration,
      staff_member.name as staff_member_name,
      case
        when appointment.status::text = 'cancelled' then 'cancelled'
        when appointment.status::text = 'completed' then 'completed'
        when appointment.status::text = 'confirmed'
          and appointment.ends_at <= timezone('utc', now()) then 'awaiting-completion'
        when appointment.status::text = 'confirmed' then 'confirmed'
        else 'pending'
      end as board_status
    from public.appointments appointment
    join public.customers customer
      on customer.id = appointment.customer_id
    join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.salon_id = owner_salon.id
      and (
        staff_member_id_input is null
        or appointment.staff_member_id = staff_member_id_input
      )
      and (
        date_from_input is null
        or (appointment.date at time zone owner_timezone)::date >= date_from_input
      )
      and (
        date_to_input is null
        or (appointment.date at time zone owner_timezone)::date <= date_to_input
      )
      and (
        normalized_search is null
        or customer.name ilike '%' || normalized_search || '%'
        or service.name ilike '%' || normalized_search || '%'
        or coalesce(service.category, '') ilike '%' || normalized_search || '%'
        or coalesce(staff_member.name, '') ilike '%' || normalized_search || '%'
      )
  ),
  filtered as (
    select *
    from base
    where normalized_board_status is null
       or board_status = normalized_board_status
  ),
  paged as (
    select *
    from filtered
    order by date asc, id asc
    limit safe_page_size
    offset (effective_page - 1) * safe_page_size
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'cancellation_reason', paged.cancellation_reason,
        'cancelled_at', paged.cancelled_at,
        'cancelled_by', paged.cancelled_by,
        'completed_at', paged.completed_at,
        'customer_confirmation_requested_at', paged.customer_confirmation_requested_at,
        'customer_presence_confirmed_at', paged.customer_presence_confirmed_at,
        'date', paged.date,
        'ends_at', paged.ends_at,
        'status', paged.status,
        'board_status', paged.board_status,
        'customer_name', paged.customer_name,
        'service_category', paged.service_category,
        'service_name', paged.service_name,
        'service_duration', paged.service_duration,
        'staff_member_name', paged.staff_member_name
      )
      order by paged.date asc, paged.id asc
    ),
    '[]'::jsonb
  )
  into items
  from paged;

  return jsonb_build_object(
    'overview', overview,
    'total_count', total_count,
    'total_pages', total_pages,
    'page', effective_page,
    'page_size', safe_page_size,
    'items', items
  );
end;
$$;

grant execute on function public.get_owner_appointment_board(text, date, date, uuid, text, integer, integer)
to authenticated;

create or replace function public.get_owner_customer_directory(
  search_input text default null,
  segment_input text default 'all',
  sort_input text default 'recent',
  page_input integer default 1,
  page_size_input integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner_salon public.salons;
  configured_program public.salon_loyalty_programs;
  normalized_search text := nullif(btrim(coalesce(search_input, '')), '');
  normalized_segment text := lower(nullif(btrim(coalesce(segment_input, '')), ''));
  normalized_sort text := lower(nullif(btrim(coalesce(sort_input, '')), ''));
  safe_page integer := greatest(coalesce(page_input, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size_input, 15), 1), 50);
  effective_page integer := 1;
  total_count integer := 0;
  total_pages integer := 1;
  items jsonb := '[]'::jsonb;
  overview jsonb := jsonb_build_object(
    'total_customers', 0,
    'vip_customers', 0,
    'cashback_customers', 0,
    'customers_with_upcoming_appointment', 0,
    'returning_customers', 0
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

  select *
  into configured_program
  from public.salon_loyalty_programs
  where salon_id = owner_salon.id
  limit 1;

  if normalized_segment not in ('all', 'vip', 'cashback', 'returning', 'upcoming', 'new') then
    normalized_segment := 'all';
  end if;

  if normalized_sort not in ('recent', 'name', 'loyalty', 'spent', 'upcoming') then
    normalized_sort := 'recent';
  end if;

  with loyalty_balances as (
    select
      loyalty.customer_id,
      coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
      coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance,
      max(loyalty.created_at) as last_reward_at
    from public.customer_loyalty_transactions loyalty
    where loyalty.salon_id = owner_salon.id
    group by loyalty.customer_id
  ),
  appointment_stats as (
    select
      appointment.customer_id,
      count(*) filter (where appointment.status::text = 'completed')::integer as completed_visits,
      count(*) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )::integer as upcoming_appointments,
      count(*) filter (where appointment.status::text = 'pending')::integer as pending_appointments,
      min(appointment.date) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      ) as next_appointment_at,
      max(appointment.date) filter (where appointment.status::text = 'completed') as last_visit_at,
      coalesce(sum(service.price) filter (where appointment.status::text = 'completed'), 0)::numeric(10, 2) as total_spent
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
    group by appointment.customer_id
  ),
  base as (
    select
      customer.id,
      customer.name,
      customer.created_at,
      customer.referral_code,
      coalesce(loyalty.points_balance, 0)::integer as points_balance,
      coalesce(loyalty.cashback_balance, 0)::numeric(10, 2) as cashback_balance,
      coalesce(appointment.completed_visits, 0)::integer as completed_visits,
      coalesce(appointment.upcoming_appointments, 0)::integer as upcoming_appointments,
      coalesce(appointment.pending_appointments, 0)::integer as pending_appointments,
      appointment.next_appointment_at,
      appointment.last_visit_at,
      coalesce(appointment.total_spent, 0)::numeric(10, 2) as total_spent,
      loyalty.last_reward_at,
      case
        when configured_program.id is null or configured_program.is_active is not true then null
        else public.resolve_loyalty_tier_snapshot(
          configured_program.tier_one_name,
          configured_program.tier_one_min_visits,
          configured_program.tier_one_discount_percent,
          configured_program.tier_two_name,
          configured_program.tier_two_min_visits,
          configured_program.tier_two_discount_percent,
          configured_program.vip_tier_name,
          configured_program.vip_min_visits,
          configured_program.vip_discount_percent,
          coalesce(appointment.completed_visits, 0)
        )
      end as current_tier
    from public.customers customer
    left join loyalty_balances loyalty
      on loyalty.customer_id = customer.id
    left join appointment_stats appointment
      on appointment.customer_id = customer.id
    where customer.salon_id = owner_salon.id
      and (
        normalized_search is null
        or customer.name ilike '%' || normalized_search || '%'
        or coalesce(customer.referral_code, '') ilike '%' || normalized_search || '%'
      )
  )
  select jsonb_build_object(
    'total_customers', count(*),
    'vip_customers', count(*) filter (where coalesce((current_tier ->> 'is_vip')::boolean, false)),
    'cashback_customers', count(*) filter (where cashback_balance > 0),
    'customers_with_upcoming_appointment', count(*) filter (where next_appointment_at is not null),
    'returning_customers', count(*) filter (where completed_visits >= 2)
  )
  into overview
  from base;

  with loyalty_balances as (
    select
      loyalty.customer_id,
      coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
      coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance,
      max(loyalty.created_at) as last_reward_at
    from public.customer_loyalty_transactions loyalty
    where loyalty.salon_id = owner_salon.id
    group by loyalty.customer_id
  ),
  appointment_stats as (
    select
      appointment.customer_id,
      count(*) filter (where appointment.status::text = 'completed')::integer as completed_visits,
      count(*) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )::integer as upcoming_appointments,
      count(*) filter (where appointment.status::text = 'pending')::integer as pending_appointments,
      min(appointment.date) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      ) as next_appointment_at,
      max(appointment.date) filter (where appointment.status::text = 'completed') as last_visit_at,
      coalesce(sum(service.price) filter (where appointment.status::text = 'completed'), 0)::numeric(10, 2) as total_spent
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
    group by appointment.customer_id
  ),
  base as (
    select
      customer.id,
      customer.name,
      customer.created_at,
      customer.referral_code,
      coalesce(loyalty.points_balance, 0)::integer as points_balance,
      coalesce(loyalty.cashback_balance, 0)::numeric(10, 2) as cashback_balance,
      coalesce(appointment.completed_visits, 0)::integer as completed_visits,
      coalesce(appointment.upcoming_appointments, 0)::integer as upcoming_appointments,
      coalesce(appointment.pending_appointments, 0)::integer as pending_appointments,
      appointment.next_appointment_at,
      appointment.last_visit_at,
      coalesce(appointment.total_spent, 0)::numeric(10, 2) as total_spent,
      loyalty.last_reward_at,
      case
        when configured_program.id is null or configured_program.is_active is not true then null
        else public.resolve_loyalty_tier_snapshot(
          configured_program.tier_one_name,
          configured_program.tier_one_min_visits,
          configured_program.tier_one_discount_percent,
          configured_program.tier_two_name,
          configured_program.tier_two_min_visits,
          configured_program.tier_two_discount_percent,
          configured_program.vip_tier_name,
          configured_program.vip_min_visits,
          configured_program.vip_discount_percent,
          coalesce(appointment.completed_visits, 0)
        )
      end as current_tier
    from public.customers customer
    left join loyalty_balances loyalty
      on loyalty.customer_id = customer.id
    left join appointment_stats appointment
      on appointment.customer_id = customer.id
    where customer.salon_id = owner_salon.id
      and (
        normalized_search is null
        or customer.name ilike '%' || normalized_search || '%'
        or coalesce(customer.referral_code, '') ilike '%' || normalized_search || '%'
      )
  ),
  filtered as (
    select *
    from base
    where case
      when normalized_segment = 'vip' then coalesce((current_tier ->> 'is_vip')::boolean, false)
      when normalized_segment = 'cashback' then cashback_balance > 0
      when normalized_segment = 'returning' then completed_visits >= 2
      when normalized_segment = 'upcoming' then next_appointment_at is not null
      when normalized_segment = 'new' then created_at >= timezone('utc', now()) - interval '30 days'
      else true
    end
  )
  select count(*)
  into total_count
  from filtered;

  total_pages := greatest(ceil(greatest(total_count, 1)::numeric / safe_page_size)::integer, 1);
  effective_page := least(safe_page, total_pages);

  with loyalty_balances as (
    select
      loyalty.customer_id,
      coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
      coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance,
      max(loyalty.created_at) as last_reward_at
    from public.customer_loyalty_transactions loyalty
    where loyalty.salon_id = owner_salon.id
    group by loyalty.customer_id
  ),
  appointment_stats as (
    select
      appointment.customer_id,
      count(*) filter (where appointment.status::text = 'completed')::integer as completed_visits,
      count(*) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )::integer as upcoming_appointments,
      count(*) filter (where appointment.status::text = 'pending')::integer as pending_appointments,
      min(appointment.date) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      ) as next_appointment_at,
      max(appointment.date) filter (where appointment.status::text = 'completed') as last_visit_at,
      coalesce(sum(service.price) filter (where appointment.status::text = 'completed'), 0)::numeric(10, 2) as total_spent
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
    group by appointment.customer_id
  ),
  base as (
    select
      customer.id,
      customer.name,
      customer.created_at,
      customer.referral_code,
      coalesce(loyalty.points_balance, 0)::integer as points_balance,
      coalesce(loyalty.cashback_balance, 0)::numeric(10, 2) as cashback_balance,
      coalesce(appointment.completed_visits, 0)::integer as completed_visits,
      coalesce(appointment.upcoming_appointments, 0)::integer as upcoming_appointments,
      coalesce(appointment.pending_appointments, 0)::integer as pending_appointments,
      appointment.next_appointment_at,
      appointment.last_visit_at,
      coalesce(appointment.total_spent, 0)::numeric(10, 2) as total_spent,
      loyalty.last_reward_at,
      case
        when configured_program.id is null or configured_program.is_active is not true then null
        else public.resolve_loyalty_tier_snapshot(
          configured_program.tier_one_name,
          configured_program.tier_one_min_visits,
          configured_program.tier_one_discount_percent,
          configured_program.tier_two_name,
          configured_program.tier_two_min_visits,
          configured_program.tier_two_discount_percent,
          configured_program.vip_tier_name,
          configured_program.vip_min_visits,
          configured_program.vip_discount_percent,
          coalesce(appointment.completed_visits, 0)
        )
      end as current_tier
    from public.customers customer
    left join loyalty_balances loyalty
      on loyalty.customer_id = customer.id
    left join appointment_stats appointment
      on appointment.customer_id = customer.id
    where customer.salon_id = owner_salon.id
      and (
        normalized_search is null
        or customer.name ilike '%' || normalized_search || '%'
        or coalesce(customer.referral_code, '') ilike '%' || normalized_search || '%'
      )
  ),
  filtered as (
    select *
    from base
    where case
      when normalized_segment = 'vip' then coalesce((current_tier ->> 'is_vip')::boolean, false)
      when normalized_segment = 'cashback' then cashback_balance > 0
      when normalized_segment = 'returning' then completed_visits >= 2
      when normalized_segment = 'upcoming' then next_appointment_at is not null
      when normalized_segment = 'new' then created_at >= timezone('utc', now()) - interval '30 days'
      else true
    end
  ),
  paged as (
    select *
    from filtered
    order by
      case when normalized_sort = 'name' then name end asc nulls last,
      case when normalized_sort = 'upcoming' then next_appointment_at end asc nulls last,
      case when normalized_sort = 'loyalty' then points_balance end desc nulls last,
      case when normalized_sort = 'spent' then total_spent end desc nulls last,
      case when normalized_sort = 'recent' then created_at end desc nulls last,
      case when normalized_sort = 'loyalty' then completed_visits end desc nulls last,
      name asc
    limit safe_page_size
    offset (effective_page - 1) * safe_page_size
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'name', paged.name,
        'created_at', paged.created_at,
        'referral_code', paged.referral_code,
        'points_balance', paged.points_balance,
        'cashback_balance', paged.cashback_balance,
        'completed_visits', paged.completed_visits,
        'upcoming_appointments', paged.upcoming_appointments,
        'pending_appointments', paged.pending_appointments,
        'next_appointment_at', paged.next_appointment_at,
        'last_visit_at', paged.last_visit_at,
        'total_spent', paged.total_spent,
        'last_reward_at', paged.last_reward_at,
        'current_tier', paged.current_tier
      )
      order by
        case when normalized_sort = 'name' then paged.name end asc nulls last,
        case when normalized_sort = 'upcoming' then paged.next_appointment_at end asc nulls last,
        case when normalized_sort = 'loyalty' then paged.points_balance end desc nulls last,
        case when normalized_sort = 'spent' then paged.total_spent end desc nulls last,
        case when normalized_sort = 'recent' then paged.created_at end desc nulls last,
        case when normalized_sort = 'loyalty' then paged.completed_visits end desc nulls last,
        paged.name asc
    ),
    '[]'::jsonb
  )
  into items
  from paged;

  return jsonb_build_object(
    'overview', overview,
    'total_count', total_count,
    'total_pages', total_pages,
    'page', effective_page,
    'page_size', safe_page_size,
    'items', items
  );
end;
$$;

grant execute on function public.get_owner_customer_directory(text, text, text, integer, integer)
to authenticated;

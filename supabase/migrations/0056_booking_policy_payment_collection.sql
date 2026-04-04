alter table public.salons
add column if not exists booking_policy_payment_mode text not null default 'manual',
add column if not exists booking_policy_pix_key text,
add column if not exists booking_policy_pix_recipient_name text,
add column if not exists booking_policy_pix_recipient_city text,
add column if not exists booking_policy_external_checkout_url text;

alter table public.salons
drop constraint if exists salons_booking_policy_payment_mode_check,
drop constraint if exists salons_booking_policy_pix_key_length_check,
drop constraint if exists salons_booking_policy_pix_recipient_name_length_check,
drop constraint if exists salons_booking_policy_pix_recipient_city_length_check,
drop constraint if exists salons_booking_policy_external_checkout_url_length_check;

alter table public.salons
add constraint salons_booking_policy_payment_mode_check
check (booking_policy_payment_mode in ('manual', 'pix', 'external_checkout')),
add constraint salons_booking_policy_pix_key_length_check
check (
  booking_policy_pix_key is null
  or char_length(btrim(booking_policy_pix_key)) between 1 and 120
),
add constraint salons_booking_policy_pix_recipient_name_length_check
check (
  booking_policy_pix_recipient_name is null
  or char_length(btrim(booking_policy_pix_recipient_name)) between 2 and 60
),
add constraint salons_booking_policy_pix_recipient_city_length_check
check (
  booking_policy_pix_recipient_city is null
  or char_length(btrim(booking_policy_pix_recipient_city)) between 2 and 30
),
add constraint salons_booking_policy_external_checkout_url_length_check
check (
  booking_policy_external_checkout_url is null
  or char_length(btrim(booking_policy_external_checkout_url)) between 12 and 500
);

alter table public.appointments
add column if not exists deposit_customer_reported_paid_at timestamptz,
add column if not exists deposit_customer_reported_paid_via text,
add column if not exists deposit_customer_reported_reference text;

alter table public.appointments
drop constraint if exists appointments_deposit_customer_reported_paid_via_check,
drop constraint if exists appointments_deposit_customer_reported_reference_length_check;

alter table public.appointments
add constraint appointments_deposit_customer_reported_paid_via_check
check (
  deposit_customer_reported_paid_via is null
  or deposit_customer_reported_paid_via in ('manual', 'pix', 'external_checkout')
),
add constraint appointments_deposit_customer_reported_reference_length_check
check (
  deposit_customer_reported_reference is null
  or char_length(btrim(deposit_customer_reported_reference)) between 1 and 120
);

create or replace function public.report_appointment_deposit_paid(
  appointment_uuid uuid,
  payment_method_input text default null,
  payment_reference_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  target_appointment public.appointments;
  reported_appointment public.appointments;
  normalized_payment_method text := coalesce(
    nullif(btrim(lower(coalesce(payment_method_input, ''))), ''),
    'manual'
  );
  normalized_payment_reference text := nullif(
    left(btrim(coalesce(payment_reference_input, '')), 120),
    ''
  );
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid();

  if customer_profile.id is null then
    raise exception 'customer_not_linked';
  end if;

  if normalized_payment_method not in ('manual', 'pix', 'external_checkout') then
    raise exception 'invalid_payment_method';
  end if;

  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.customer_id <> customer_profile.id then
    raise exception 'unauthorized';
  end if;

  if target_appointment.status::text not in ('pending', 'confirmed') then
    raise exception 'appointment_not_collectable';
  end if;

  if target_appointment.date <= timezone('utc', now()) then
    raise exception 'appointment_already_started';
  end if;

  if coalesce(target_appointment.deposit_amount, 0) <= 0 then
    raise exception 'deposit_not_required';
  end if;

  if target_appointment.deposit_status <> 'pending' then
    return target_appointment;
  end if;

  update public.appointments
  set
    deposit_customer_reported_paid_at = timezone('utc', now()),
    deposit_customer_reported_paid_via = normalized_payment_method,
    deposit_customer_reported_reference = normalized_payment_reference
  where id = target_appointment.id
  returning * into reported_appointment;

  return reported_appointment;
end;
$$;

grant execute on function public.report_appointment_deposit_paid(uuid, text, text)
to authenticated;

drop function if exists public.get_owner_appointment_board(text, date, date, uuid, text, integer, integer);

create or replace function public.get_owner_appointment_board(
  search_input text default null,
  date_from_input date default null,
  date_to_input date default null,
  staff_member_id_input uuid default null,
  board_status_input text default null,
  page_input integer default 1,
  page_size_input integer default 18
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
  normalized_board_status text := nullif(btrim(coalesce(board_status_input, '')), '');
  safe_page integer := greatest(coalesce(page_input, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size_input, 18), 1), 100);
  total_count integer := 0;
  total_pages integer := 1;
  effective_page integer := 1;
  overview jsonb := jsonb_build_object(
    'pending', 0,
    'confirmed', 0,
    'awaiting_completion', 0,
    'completed', 0,
    'cancelled', 0,
    'deposit_pending', 0,
    'deposit_received', 0
  );
  items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

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
      appointment.booking_policy_acknowledged_at,
      appointment.booking_policy_snapshot,
      appointment.booking_policy_version,
      appointment.cancellation_reason,
      appointment.cancelled_at,
      appointment.cancelled_by,
      appointment.completed_at,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      appointment.date,
      appointment.deposit_amount,
      appointment.deposit_customer_reported_paid_at,
      appointment.deposit_customer_reported_paid_via,
      appointment.deposit_customer_reported_reference,
      appointment.deposit_notes,
      appointment.deposit_paid_at,
      appointment.deposit_status,
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
    'cancelled', count(*) filter (where board_status = 'cancelled'),
    'deposit_pending', count(*) filter (where deposit_status = 'pending' and deposit_amount > 0),
    'deposit_received', count(*) filter (where deposit_status = 'received' and deposit_amount > 0)
  )
  into overview
  from base;

  with base as (
    select
      appointment.id,
      appointment.booking_policy_acknowledged_at,
      appointment.booking_policy_snapshot,
      appointment.booking_policy_version,
      appointment.cancellation_reason,
      appointment.cancelled_at,
      appointment.cancelled_by,
      appointment.completed_at,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      appointment.date,
      appointment.deposit_amount,
      appointment.deposit_customer_reported_paid_at,
      appointment.deposit_customer_reported_paid_via,
      appointment.deposit_customer_reported_reference,
      appointment.deposit_notes,
      appointment.deposit_paid_at,
      appointment.deposit_status,
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
      appointment.booking_policy_acknowledged_at,
      appointment.booking_policy_snapshot,
      appointment.booking_policy_version,
      appointment.cancellation_reason,
      appointment.cancelled_at,
      appointment.cancelled_by,
      appointment.completed_at,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      appointment.date,
      appointment.deposit_amount,
      appointment.deposit_customer_reported_paid_at,
      appointment.deposit_customer_reported_paid_via,
      appointment.deposit_customer_reported_reference,
      appointment.deposit_notes,
      appointment.deposit_paid_at,
      appointment.deposit_status,
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
        'booking_policy_acknowledged_at', paged.booking_policy_acknowledged_at,
        'booking_policy_snapshot', paged.booking_policy_snapshot,
        'booking_policy_version', paged.booking_policy_version,
        'cancellation_reason', paged.cancellation_reason,
        'cancelled_at', paged.cancelled_at,
        'cancelled_by', paged.cancelled_by,
        'completed_at', paged.completed_at,
        'customer_confirmation_requested_at', paged.customer_confirmation_requested_at,
        'customer_presence_confirmed_at', paged.customer_presence_confirmed_at,
        'date', paged.date,
        'deposit_amount', paged.deposit_amount,
        'deposit_customer_reported_paid_at', paged.deposit_customer_reported_paid_at,
        'deposit_customer_reported_paid_via', paged.deposit_customer_reported_paid_via,
        'deposit_customer_reported_reference', paged.deposit_customer_reported_reference,
        'deposit_notes', paged.deposit_notes,
        'deposit_paid_at', paged.deposit_paid_at,
        'deposit_status', paged.deposit_status,
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

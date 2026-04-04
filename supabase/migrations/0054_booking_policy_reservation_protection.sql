alter table public.salons
add column if not exists booking_policy_enabled boolean not null default false,
add column if not exists booking_policy_title text not null default 'Reserva protegida',
add column if not exists booking_policy_summary text,
add column if not exists booking_policy_cancellation_window_hours integer not null default 24,
add column if not exists booking_policy_requires_deposit boolean not null default false,
add column if not exists booking_policy_deposit_amount numeric(10, 2),
add column if not exists booking_policy_payment_instructions text,
add column if not exists booking_policy_version text not null default '2026-04-booking-policy-v1';

alter table public.salons
drop constraint if exists salons_booking_policy_title_length_check,
drop constraint if exists salons_booking_policy_summary_length_check,
drop constraint if exists salons_booking_policy_cancellation_window_hours_check,
drop constraint if exists salons_booking_policy_deposit_amount_check,
drop constraint if exists salons_booking_policy_version_length_check;

alter table public.salons
add constraint salons_booking_policy_title_length_check
check (char_length(btrim(booking_policy_title)) between 1 and 120),
add constraint salons_booking_policy_summary_length_check
check (
  booking_policy_summary is null
  or char_length(btrim(booking_policy_summary)) between 1 and 600
),
add constraint salons_booking_policy_cancellation_window_hours_check
check (booking_policy_cancellation_window_hours between 0 and 168),
add constraint salons_booking_policy_deposit_amount_check
check (
  booking_policy_deposit_amount is null
  or booking_policy_deposit_amount >= 0
),
add constraint salons_booking_policy_version_length_check
check (char_length(btrim(booking_policy_version)) between 1 and 80);

alter table public.appointments
add column if not exists booking_policy_version text,
add column if not exists booking_policy_snapshot text,
add column if not exists booking_policy_acknowledged_at timestamptz,
add column if not exists deposit_amount numeric(10, 2) not null default 0,
add column if not exists deposit_status text not null default 'not_required',
add column if not exists deposit_paid_at timestamptz,
add column if not exists deposit_notes text;

alter table public.appointments
drop constraint if exists appointments_booking_policy_version_length_check,
drop constraint if exists appointments_booking_policy_snapshot_length_check,
drop constraint if exists appointments_deposit_amount_check,
drop constraint if exists appointments_deposit_status_check,
drop constraint if exists appointments_deposit_notes_length_check;

alter table public.appointments
add constraint appointments_booking_policy_version_length_check
check (
  booking_policy_version is null
  or char_length(btrim(booking_policy_version)) between 1 and 80
),
add constraint appointments_booking_policy_snapshot_length_check
check (
  booking_policy_snapshot is null
  or char_length(btrim(booking_policy_snapshot)) between 1 and 2000
),
add constraint appointments_deposit_amount_check
check (deposit_amount >= 0),
add constraint appointments_deposit_status_check
check (deposit_status in ('not_required', 'pending', 'received', 'waived', 'refunded')),
add constraint appointments_deposit_notes_length_check
check (
  deposit_notes is null
  or char_length(btrim(deposit_notes)) between 1 and 400
);

update public.salons
set booking_policy_version = coalesce(
  nullif(btrim(booking_policy_version), ''),
  '2026-04-booking-policy-v1'
);

update public.appointments
set
  deposit_amount = coalesce(deposit_amount, 0),
  deposit_status = case
    when coalesce(deposit_amount, 0) > 0
      and coalesce(nullif(btrim(deposit_status), ''), 'pending') not in ('not_required', 'pending', 'received', 'waived', 'refunded')
      then 'pending'
    else coalesce(nullif(btrim(deposit_status), ''), 'not_required')
  end;

drop function if exists public.create_appointment(uuid, timestamptz, uuid);

create or replace function public.create_appointment(
  service_uuid uuid,
  requested_date timestamptz,
  preferred_staff_member_uuid uuid default null,
  booking_policy_version_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  selected_service public.services;
  configured_salon public.salons;
  created_appointment public.appointments;
  requested_end timestamptz;
  local_requested_day date;
  schedule record;
  requested_salon_timezone text;
  resolved_staff_member_id uuid;
  preferred_staff_valid boolean;
  normalized_booking_policy_input text := nullif(btrim(coalesce(booking_policy_version_input, '')), '');
  effective_booking_policy_version text := null;
  effective_booking_policy_snapshot text := null;
  effective_booking_policy_acknowledged_at timestamptz := null;
  effective_deposit_amount numeric(10, 2) := 0;
  effective_deposit_status text := 'not_required';
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

  select *
  into selected_service
  from public.services
  where id = service_uuid
    and salon_id = customer_profile.salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  if preferred_staff_member_uuid is not null then
    select exists (
      select 1
      from public.staff_members sm
      join public.staff_service_assignments ssa
        on ssa.staff_member_id = sm.id
      where sm.id = preferred_staff_member_uuid
        and sm.salon_id = customer_profile.salon_id
        and sm.is_active
        and ssa.service_id = selected_service.id
    )
    into preferred_staff_valid;

    if not preferred_staff_valid then
      raise exception 'staff_member_not_available_for_service';
    end if;
  end if;

  select *
  into configured_salon
  from public.salons
  where id = customer_profile.salon_id;

  if configured_salon.id is null then
    raise exception 'salon_not_found';
  end if;

  requested_salon_timezone := configured_salon.timezone;

  if requested_salon_timezone is null then
    raise exception 'schedule_not_found';
  end if;

  if configured_salon.booking_policy_enabled then
    effective_booking_policy_version := configured_salon.booking_policy_version;
    effective_booking_policy_snapshot := format(
      E'%s\nResumo: %s\nCancelamento sem atrito ate %s hora(s) antes.\nSinal exigido: %s.\nValor do sinal: %s.\nPagamento/orientacoes: %s',
      coalesce(nullif(btrim(configured_salon.booking_policy_title), ''), 'Reserva protegida'),
      coalesce(
        nullif(btrim(configured_salon.booking_policy_summary), ''),
        'A reserva segue as regras operacionais definidas pelo salao.'
      ),
      configured_salon.booking_policy_cancellation_window_hours,
      case
        when configured_salon.booking_policy_requires_deposit
          and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0
          then 'sim'
        else 'nao'
      end,
      case
        when configured_salon.booking_policy_requires_deposit
          and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0
          then to_char(configured_salon.booking_policy_deposit_amount, 'FM999999990.00')
        else '0.00'
      end,
      coalesce(
        nullif(btrim(configured_salon.booking_policy_payment_instructions), ''),
        'Alinhe com o salao a melhor forma de confirmar a reserva.'
      )
    );

    if normalized_booking_policy_input is not null then
      if normalized_booking_policy_input <> configured_salon.booking_policy_version then
        raise exception 'booking_policy_version_stale';
      end if;

      effective_booking_policy_acknowledged_at := timezone('utc', now());
    end if;

    if configured_salon.booking_policy_requires_deposit
      and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0 then
      effective_deposit_amount := configured_salon.booking_policy_deposit_amount;
      effective_deposit_status := 'pending';
    end if;
  end if;

  local_requested_day := (requested_date at time zone requested_salon_timezone)::date;

  select *
  into schedule
  from public.get_salon_schedule_context(customer_profile.salon_id, local_requested_day);

  if schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  if not schedule.is_open then
    raise exception 'salon_closed_on_selected_day';
  end if;

  if requested_date <= timezone('utc', now()) then
    raise exception 'past_time_not_allowed';
  end if;

  requested_end := requested_date + make_interval(mins => selected_service.duration);

  if requested_date < schedule.opens_at_utc or requested_end > schedule.closes_at_utc then
    raise exception 'outside_business_hours';
  end if;

  if mod(
    extract(epoch from requested_date - schedule.opens_at_utc)::bigint,
    (schedule.slot_step_minutes * 60)::bigint
  ) <> 0 then
    raise exception 'slot_step_mismatch';
  end if;

  select available_slot.staff_member_id
  into resolved_staff_member_id
  from public.get_available_staff_slots_for_service(selected_service.id, local_requested_day) available_slot
  where available_slot.start_at = requested_date
    and (
      preferred_staff_member_uuid is null
      or available_slot.staff_member_id = preferred_staff_member_uuid
    )
  order by available_slot.staff_member_name
  limit 1;

  if resolved_staff_member_id is null then
    raise exception 'time_slot_unavailable';
  end if;

  insert into public.appointments (
    salon_id,
    customer_id,
    service_id,
    staff_member_id,
    date,
    ends_at,
    status,
    booking_policy_version,
    booking_policy_snapshot,
    booking_policy_acknowledged_at,
    deposit_amount,
    deposit_status
  )
  values (
    customer_profile.salon_id,
    customer_profile.id,
    selected_service.id,
    resolved_staff_member_id,
    requested_date,
    requested_end,
    'pending',
    effective_booking_policy_version,
    effective_booking_policy_snapshot,
    effective_booking_policy_acknowledged_at,
    effective_deposit_amount,
    effective_deposit_status
  )
  returning * into created_appointment;

  delete from public.salon_vacancy_alerts
  where salon_id = customer_profile.salon_id
    and service_id = selected_service.id
    and starts_at = requested_date
    and ends_at = requested_end
    and (
      staff_member_id = resolved_staff_member_id
      or staff_member_id is null
    );

  return created_appointment;
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

grant execute on function public.create_appointment(uuid, timestamptz, uuid, text)
to authenticated;

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
    'cancelled', 0,
    'deposit_pending', 0,
    'deposit_received', 0
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

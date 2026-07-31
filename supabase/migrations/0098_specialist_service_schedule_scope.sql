create or replace function public.get_available_staff_slots_for_service(service_uuid uuid, target_day date)
returns table (
  start_at timestamptz,
  ends_at timestamptz,
  staff_member_id uuid,
  staff_member_name text
)
language sql
security definer
set search_path = public
as $$
  with service_context as (
    select s.id as service_id, s.salon_id, s.duration
    from public.services s
    where s.id = service_uuid
  ),
  service_staff_scope as (
    select
      sc.service_id,
      exists (
        select 1
        from public.staff_service_assignments specialist_assignment
        join public.staff_members specialist
          on specialist.id = specialist_assignment.staff_member_id
        where specialist_assignment.service_id = sc.service_id
          and specialist.salon_id = sc.salon_id
          and specialist.is_active
          and not specialist.is_default
      ) as has_specialist_staff
    from service_context sc
  ),
  schedule as (
    select sc.service_id, sc.salon_id, sc.duration, gsc.timezone, gsc.slot_step_minutes, gsc.is_open, gsc.opens_at,
           gsc.closes_at, gsc.opens_at_utc, gsc.closes_at_utc
    from service_context sc
    join lateral public.get_salon_schedule_context(sc.salon_id, target_day) gsc on true
  ),
  eligible_staff as (
    select
      sm.id,
      sm.name,
      sm.is_default,
      gssc.is_open as staff_is_open,
      gssc.opens_at as staff_opens_at,
      gssc.closes_at as staff_closes_at,
      gssc.opens_at_utc as staff_opens_at_utc,
      gssc.closes_at_utc as staff_closes_at_utc
    from service_context sc
    join service_staff_scope scope
      on scope.service_id = sc.service_id
    join public.staff_service_assignments ssa
      on ssa.service_id = sc.service_id
    join public.staff_members sm
      on sm.id = ssa.staff_member_id
    join lateral public.get_staff_schedule_context(sm.id, target_day) gssc on true
    where sm.salon_id = sc.salon_id
      and sm.is_active
      and (
        not sm.is_default
        or not scope.has_specialist_staff
      )
  )
  select
    slot.start_at,
    slot.start_at + make_interval(mins => schedule.duration) as ends_at,
    eligible_staff.id,
    eligible_staff.name
  from schedule
  join eligible_staff
    on eligible_staff.staff_is_open
  cross join lateral (
    select
      greatest(schedule.opens_at_utc, eligible_staff.staff_opens_at_utc) as effective_opens_at_utc,
      least(schedule.closes_at_utc, eligible_staff.staff_closes_at_utc) as effective_closes_at_utc
  ) staff_window
  cross join lateral (
    select
      schedule.opens_at_utc
        + make_interval(
            secs => (
              ceil(
                greatest(
                  0,
                  extract(epoch from staff_window.effective_opens_at_utc - schedule.opens_at_utc)
                ) / (schedule.slot_step_minutes * 60)
              )::integer * schedule.slot_step_minutes * 60
            )
          ) as aligned_opens_at_utc
  ) aligned_window
  cross join lateral generate_series(
    aligned_window.aligned_opens_at_utc,
    staff_window.effective_closes_at_utc - make_interval(mins => schedule.duration),
    make_interval(mins => schedule.slot_step_minutes)
  ) as slot(start_at)
  where schedule.is_open
    and schedule.opens_at_utc is not null
    and schedule.closes_at_utc is not null
    and eligible_staff.staff_opens_at_utc is not null
    and eligible_staff.staff_closes_at_utc is not null
    and staff_window.effective_opens_at_utc < staff_window.effective_closes_at_utc
    and aligned_window.aligned_opens_at_utc <= staff_window.effective_closes_at_utc - make_interval(mins => schedule.duration)
    and slot.start_at > timezone('utc', now())
    and not exists (
      select 1
      from public.appointments a
      where a.staff_member_id = eligible_staff.id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.date, a.ends_at, '[)') && tstzrange(
          slot.start_at,
          slot.start_at + make_interval(mins => schedule.duration),
          '[)'
        )
    )
    and not exists (
      select 1
      from public.staff_blocks sb
      where sb.staff_member_id = eligible_staff.id
        and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(
          slot.start_at,
          slot.start_at + make_interval(mins => schedule.duration),
          '[)'
        )
    )
  order by slot.start_at, eligible_staff.name;
$$;

grant execute on function public.get_available_staff_slots_for_service(uuid, date)
to authenticated;

create or replace function public.get_day_availability(service_uuid uuid, target_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  selected_service public.services;
  schedule record;
  slots jsonb := '[]'::jsonb;
  staff_members jsonb := '[]'::jsonb;
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

  select *
  into schedule
  from public.get_salon_schedule_context(customer_profile.salon_id, target_day);

  if schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  with service_staff_scope as (
    select exists (
      select 1
      from public.staff_service_assignments specialist_assignment
      join public.staff_members specialist
        on specialist.id = specialist_assignment.staff_member_id
      where specialist_assignment.service_id = selected_service.id
        and specialist.salon_id = customer_profile.salon_id
        and specialist.is_active
        and not specialist.is_default
    ) as has_specialist_staff
  ),
  slot_summary as (
    select
      available_slot.staff_member_id,
      count(*)::int as available_slots_count,
      min(available_slot.start_at) as next_available_at
    from public.get_available_staff_slots_for_service(selected_service.id, target_day) available_slot
    group by available_slot.staff_member_id
  ),
  block_summary as (
    select
      sb.staff_member_id,
      jsonb_agg(
        jsonb_build_object(
          'starts_at', sb.starts_at,
          'ends_at', sb.ends_at,
          'reason', sb.reason
        )
        order by sb.starts_at
      ) as blocked_ranges
    from public.staff_blocks sb
    where sb.salon_id = customer_profile.salon_id
      and schedule.opens_at_utc is not null
      and schedule.closes_at_utc is not null
      and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(schedule.opens_at_utc, schedule.closes_at_utc, '[)')
    group by sb.staff_member_id
  ),
  current_attendance_summary as (
    select
      appointment.staff_member_id,
      min(
        coalesce(
          appointment.ends_at,
          appointment.date + make_interval(mins => selected_service.duration)
        )
      ) as current_ends_at
    from public.appointments appointment
    where appointment.salon_id = customer_profile.salon_id
      and appointment.status in ('pending', 'confirmed')
      and appointment.staff_member_id is not null
      and schedule.timezone is not null
      and (appointment.date at time zone schedule.timezone)::date = target_day
      and tstzrange(
        appointment.date,
        coalesce(
          appointment.ends_at,
          appointment.date + make_interval(mins => selected_service.duration)
        ),
        '[)'
      ) @> now()
    group by appointment.staff_member_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sm.id,
        'name', sm.name,
        'role', sm.role,
        'is_open', coalesce(gssc.is_open, false),
        'opens_at', gssc.opens_at,
        'closes_at', gssc.closes_at,
        'available_slots_count', coalesce(slot_summary.available_slots_count, 0),
        'next_available_at', slot_summary.next_available_at,
        'current_appointment_ends_at', current_attendance_summary.current_ends_at,
        'blocked_ranges', coalesce(block_summary.blocked_ranges, '[]'::jsonb),
        'status', case
          when not coalesce(gssc.is_open, false) then 'off'
          when current_attendance_summary.current_ends_at is not null then 'serving'
          when coalesce(slot_summary.available_slots_count, 0) > 0 then 'available'
          else 'busy'
        end,
        'status_detail', case
          when not coalesce(gssc.is_open, false) then 'Nao atende nesta data.'
          when current_attendance_summary.current_ends_at is not null
            then format(
              'Em atendimento ate %s. Proximos encaixes livres continuam abaixo.',
              to_char(current_attendance_summary.current_ends_at at time zone schedule.timezone, 'HH24:MI')
            )
          when coalesce(slot_summary.available_slots_count, 0) > 0 and gssc.opens_at is not null and gssc.closes_at is not null
            then format(
              'Atende de %s as %s.',
              to_char(gssc.opens_at, 'HH24:MI'),
              to_char(gssc.closes_at, 'HH24:MI')
            )
          when jsonb_array_length(coalesce(block_summary.blocked_ranges, '[]'::jsonb)) > 0
            then 'Agenda com pausas ou bloqueios nessa data.'
          else 'Sem horarios livres nesta data.'
        end
      )
      order by sm.name
    ),
    '[]'::jsonb
  )
  into staff_members
  from public.staff_members sm
  join public.staff_service_assignments ssa
    on ssa.staff_member_id = sm.id
  cross join service_staff_scope
  left join lateral public.get_staff_schedule_context(sm.id, target_day) gssc on true
  left join slot_summary
    on slot_summary.staff_member_id = sm.id
  left join block_summary
    on block_summary.staff_member_id = sm.id
  left join current_attendance_summary
    on current_attendance_summary.staff_member_id = sm.id
  where sm.salon_id = customer_profile.salon_id
    and sm.is_active
    and ssa.service_id = selected_service.id
    and (
      not sm.is_default
      or not service_staff_scope.has_specialist_staff
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'start_at', start_at,
        'ends_at', ends_at,
        'staff_member_id', staff_member_id,
        'staff_member_name', staff_member_name
      )
      order by start_at, staff_member_name
    ),
    '[]'::jsonb
  )
  into slots
  from public.get_available_staff_slots_for_service(selected_service.id, target_day);

  return jsonb_build_object(
    'target_day', target_day,
    'timezone', schedule.timezone,
    'slot_step_minutes', schedule.slot_step_minutes,
    'service_duration', selected_service.duration,
    'is_open', schedule.is_open,
    'opens_at', schedule.opens_at,
    'closes_at', schedule.closes_at,
    'staff_members', staff_members,
    'available_slots', slots
  );
end;
$$;

grant execute on function public.get_day_availability(uuid, date) to authenticated;

do $$
declare
  target_salon_id uuid;
begin
  select id
  into target_salon_id
  from public.salons
  where lower(btrim(name)) = 'studio barber'
  limit 1;

  if target_salon_id is null then
    return;
  end if;

  delete from public.staff_service_assignments assignment
  using public.staff_members staff_member, public.services service
  where assignment.staff_member_id = staff_member.id
    and assignment.service_id = service.id
    and staff_member.salon_id = target_salon_id
    and service.salon_id = target_salon_id
    and not staff_member.is_default
    and (
      (
        lower(btrim(staff_member.role)) in ('trança', 'tranca')
        and lower(btrim(service.name)) not in ('trança', 'tranca')
      )
      or (
        lower(btrim(staff_member.role)) like '%maqui%'
        and lower(btrim(service.name)) not like '%maqui%'
      )
    );

  insert into public.staff_service_assignments (staff_member_id, service_id)
  select staff_member.id, service.id
  from public.staff_members staff_member
  join public.services service
    on service.salon_id = staff_member.salon_id
  where staff_member.salon_id = target_salon_id
    and lower(btrim(staff_member.name)) = 'wesley'
    and lower(btrim(service.name)) in ('corte masculino', 'barba-degrade', 'pigmentação', 'pigmentacao')
  on conflict do nothing;
end;
$$;

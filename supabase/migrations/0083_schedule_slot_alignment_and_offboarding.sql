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
      gssc.is_open as staff_is_open,
      gssc.opens_at as staff_opens_at,
      gssc.closes_at as staff_closes_at,
      gssc.opens_at_utc as staff_opens_at_utc,
      gssc.closes_at_utc as staff_closes_at_utc
    from service_context sc
    join public.staff_service_assignments ssa
      on ssa.service_id = sc.service_id
    join public.staff_members sm
      on sm.id = ssa.staff_member_id
    join lateral public.get_staff_schedule_context(sm.id, target_day) gssc on true
    where sm.is_active
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

create or replace function public.offboard_management_professional_with_transfers(
  target_staff_member_uuid uuid,
  transfer_plans jsonb,
  block_cutoff timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  target_staff public.staff_members;
  transfer_plan jsonb;
  plan_appointment_id uuid;
  plan_customer_id uuid;
  plan_service_id uuid;
  plan_requested_date timestamptz;
  plan_replacement_staff_member_id uuid;
  plan_notes text;
  updated_appointment public.appointments;
  transferred_count integer := 0;
  deleted_blocks_count integer := 0;
begin
  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'unauthorized';
  end if;

  if jsonb_typeof(coalesce(transfer_plans, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_transfer_plan';
  end if;

  select *
  into target_staff
  from public.staff_members
  where id = target_staff_member_uuid
    and salon_id = owner_salon_id
  for update;

  if target_staff.id is null then
    raise exception 'staff_member_not_found';
  end if;

  if not target_staff.is_active then
    raise exception 'inactive_staff_member_not_allowed';
  end if;

  for transfer_plan in
    select value
    from jsonb_array_elements(coalesce(transfer_plans, '[]'::jsonb))
  loop
    plan_appointment_id := nullif(transfer_plan->>'appointmentId', '')::uuid;
    plan_customer_id := nullif(transfer_plan->>'customerId', '')::uuid;
    plan_service_id := nullif(transfer_plan->>'serviceId', '')::uuid;
    plan_requested_date := nullif(transfer_plan->>'nextStartAt', '')::timestamptz;
    plan_replacement_staff_member_id := nullif(transfer_plan->>'replacementStaffMemberId', '')::uuid;
    plan_notes := nullif(transfer_plan->>'notes', '');

    if plan_appointment_id is null
      or plan_customer_id is null
      or plan_service_id is null
      or plan_requested_date is null
      or plan_replacement_staff_member_id is null then
      raise exception 'invalid_transfer_plan';
    end if;

    perform 1
    from public.appointments appointment
    where appointment.id = plan_appointment_id
      and appointment.salon_id = owner_salon_id
      and appointment.staff_member_id = target_staff.id
      and appointment.status in ('pending', 'confirmed')
    for update;

    if not found then
      raise exception 'appointment_not_open_for_update';
    end if;

    updated_appointment := public.update_management_appointment(
      plan_appointment_id,
      plan_customer_id,
      plan_service_id,
      plan_requested_date,
      plan_replacement_staff_member_id,
      plan_notes
    );

    update public.appointments
    set status = 'pending'
    where id = updated_appointment.id
      and salon_id = owner_salon_id
    returning * into updated_appointment;

    transferred_count := transferred_count + 1;
  end loop;

  if exists (
    select 1
    from public.appointments appointment
    where appointment.salon_id = owner_salon_id
      and appointment.staff_member_id = target_staff.id
      and appointment.status in ('pending', 'confirmed')
      and appointment.date > block_cutoff
  ) then
    raise exception 'staff_member_has_untransferred_appointments';
  end if;

  update public.staff_members
  set is_active = false
  where id = target_staff.id
    and salon_id = owner_salon_id;

  delete from public.staff_blocks
  where staff_member_id = target_staff.id
    and ends_at >= block_cutoff;

  get diagnostics deleted_blocks_count = row_count;

  return jsonb_build_object(
    'transferred_count', transferred_count,
    'deleted_blocks_count', deleted_blocks_count
  );
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

grant execute on function public.offboard_management_professional_with_transfers(uuid, jsonb, timestamptz)
to authenticated;

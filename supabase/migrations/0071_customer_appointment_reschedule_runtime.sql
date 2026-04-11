create or replace function public.reschedule_appointment(
  appointment_uuid uuid,
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
  target_appointment public.appointments;
  selected_service public.services;
  created_appointment public.appointments;
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
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.customer_id <> customer_profile.id then
    raise exception 'unauthorized';
  end if;

  if target_appointment.status = 'cancelled' then
    raise exception 'appointment_already_cancelled';
  end if;

  if target_appointment.status = 'completed' then
    raise exception 'appointment_already_completed';
  end if;

  if target_appointment.ends_at <= timezone('utc', now()) then
    raise exception 'past_appointment_cannot_be_rescheduled';
  end if;

  if preferred_staff_member_uuid is not null
    and preferred_staff_member_uuid = target_appointment.staff_member_id
    and requested_date = target_appointment.date then
    raise exception 'same_slot_selected';
  end if;

  select *
  into selected_service
  from public.services
  where id = target_appointment.service_id
    and salon_id = customer_profile.salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  select *
  into created_appointment
  from public.create_appointment(
    service_uuid => selected_service.id,
    requested_date => requested_date,
    preferred_staff_member_uuid => preferred_staff_member_uuid,
    booking_policy_version_input => booking_policy_version_input
  );

  perform public.cancel_appointment(
    appointment_uuid => target_appointment.id,
    cancellation_reason_input => 'Reagendado pelo cliente no app.'
  );

  return created_appointment;
end;
$$;

grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid, text) to authenticated;

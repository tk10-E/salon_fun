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
  preserve_existing_deposit boolean := false;
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
  where id = appointment_uuid
  for update;

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

  if target_appointment.status = 'no_show' then
    raise exception 'past_appointment_cannot_be_rescheduled';
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

  perform set_config(
    'app.current_reschedule_source_appointment_id',
    target_appointment.id::text,
    true
  );

  select *
  into created_appointment
  from public.create_appointment(
    service_uuid => selected_service.id,
    requested_date => requested_date,
    preferred_staff_member_uuid => preferred_staff_member_uuid,
    booking_policy_version_input => booking_policy_version_input
  );

  preserve_existing_deposit :=
    target_appointment.deposit_status in ('received', 'waived', 'refunded')
    or target_appointment.deposit_paid_at is not null
    or target_appointment.deposit_customer_reported_paid_at is not null
    or target_appointment.deposit_payment_provider_charge_id is not null
    or target_appointment.deposit_receipt_path is not null;

  update public.appointments
  set
    notes = target_appointment.notes,
    payment_preference = coalesce(
      target_appointment.payment_preference,
      public.appointments.payment_preference
    ),
    booking_policy_acknowledged_at = case
      when target_appointment.booking_policy_acknowledged_at is not null
        and target_appointment.booking_policy_version is not null
        and target_appointment.booking_policy_version = public.appointments.booking_policy_version
        then target_appointment.booking_policy_acknowledged_at
      else public.appointments.booking_policy_acknowledged_at
    end,
    deposit_amount = case
      when preserve_existing_deposit then target_appointment.deposit_amount
      else public.appointments.deposit_amount
    end,
    deposit_status = case
      when preserve_existing_deposit then target_appointment.deposit_status
      else public.appointments.deposit_status
    end,
    deposit_paid_at = case
      when preserve_existing_deposit then target_appointment.deposit_paid_at
      else public.appointments.deposit_paid_at
    end,
    deposit_notes = case
      when preserve_existing_deposit then target_appointment.deposit_notes
      else public.appointments.deposit_notes
    end,
    deposit_customer_reported_paid_at = case
      when preserve_existing_deposit
        then target_appointment.deposit_customer_reported_paid_at
      else public.appointments.deposit_customer_reported_paid_at
    end,
    deposit_customer_reported_paid_via = case
      when preserve_existing_deposit
        then target_appointment.deposit_customer_reported_paid_via
      else public.appointments.deposit_customer_reported_paid_via
    end,
    deposit_customer_reported_reference = case
      when preserve_existing_deposit
        then target_appointment.deposit_customer_reported_reference
      else public.appointments.deposit_customer_reported_reference
    end,
    deposit_payment_provider = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider
      else public.appointments.deposit_payment_provider
    end,
    deposit_payment_provider_charge_id = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_charge_id
      else public.appointments.deposit_payment_provider_charge_id
    end,
    deposit_payment_provider_status = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_status
      else public.appointments.deposit_payment_provider_status
    end,
    deposit_payment_provider_payload = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_payload
      else public.appointments.deposit_payment_provider_payload
    end,
    deposit_payment_provider_invoice_url = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_invoice_url
      else public.appointments.deposit_payment_provider_invoice_url
    end,
    deposit_payment_provider_last_synced_at = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_last_synced_at
      else public.appointments.deposit_payment_provider_last_synced_at
    end,
    deposit_payment_provider_error = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_error
      else public.appointments.deposit_payment_provider_error
    end,
    deposit_receipt_path = case
      when preserve_existing_deposit
        then target_appointment.deposit_receipt_path
      else public.appointments.deposit_receipt_path
    end
  where public.appointments.id = created_appointment.id
  returning * into created_appointment;

  perform public.cancel_appointment(
    appointment_uuid => target_appointment.id,
    cancellation_reason_input => 'Reagendado pelo cliente no app.'
  );

  return created_appointment;
end;
$$;

grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid, text)
to authenticated;

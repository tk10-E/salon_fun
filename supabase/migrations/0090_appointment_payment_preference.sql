alter table public.appointments
add column if not exists payment_preference text;

alter table public.appointments
drop constraint if exists appointments_payment_preference_check;

alter table public.appointments
add constraint appointments_payment_preference_check
check (
  payment_preference is null
  or payment_preference in (
    'pix',
    'cash',
    'debit_card',
    'credit_card',
    'to_be_defined'
  )
);

drop function if exists public.create_management_appointment(uuid, uuid, timestamptz, uuid, text);

create or replace function public.create_management_appointment(
  customer_uuid uuid,
  service_uuid uuid,
  requested_date timestamptz,
  staff_member_uuid uuid,
  notes_input text default null,
  payment_preference_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  target_customer public.customers;
  selected_service public.services;
  selected_staff public.staff_members;
  configured_salon public.salons;
  salon_schedule record;
  staff_schedule record;
  created_appointment public.appointments;
  requested_end timestamptz;
  local_requested_day date;
  normalized_notes text := nullif(btrim(coalesce(notes_input, '')), '');
  normalized_payment_preference text := nullif(btrim(coalesce(payment_preference_input, '')), '');
  effective_booking_policy_version text := null;
  effective_booking_policy_snapshot text := null;
  effective_deposit_amount numeric(10, 2) := 0;
  effective_deposit_status text := 'not_required';
  effective_protection_auto_cancel_unconfirmed boolean := false;
  effective_protection_auto_cancel_pending_deposit boolean := false;
begin
  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'unauthorized';
  end if;

  if normalized_payment_preference is not null
    and normalized_payment_preference not in (
      'pix',
      'cash',
      'debit_card',
      'credit_card',
      'to_be_defined'
    ) then
    raise exception 'invalid_payment_preference';
  end if;

  select *
  into target_customer
  from public.customers
  where id = customer_uuid
    and salon_id = owner_salon_id;

  if target_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select *
  into selected_service
  from public.services
  where id = service_uuid
    and salon_id = owner_salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  if not selected_service.is_active then
    raise exception 'inactive_service_not_allowed';
  end if;

  select *
  into selected_staff
  from public.staff_members
  where id = staff_member_uuid
    and salon_id = owner_salon_id;

  if selected_staff.id is null then
    raise exception 'staff_member_not_found';
  end if;

  if not selected_staff.is_active then
    raise exception 'inactive_staff_member_not_allowed';
  end if;

  if not exists (
    select 1
    from public.staff_service_assignments
    where staff_member_id = selected_staff.id
      and service_id = selected_service.id
  ) then
    raise exception 'staff_member_cannot_perform_service';
  end if;

  select *
  into configured_salon
  from public.salons
  where id = owner_salon_id;

  if configured_salon.id is null then
    raise exception 'salon_not_found';
  end if;

  if configured_salon.timezone is null then
    raise exception 'schedule_not_found';
  end if;

  if configured_salon.booking_policy_enabled then
    effective_protection_auto_cancel_unconfirmed :=
      configured_salon.booking_policy_confirmation_required
      and configured_salon.booking_policy_auto_cancel_unconfirmed;
    effective_protection_auto_cancel_pending_deposit :=
      configured_salon.booking_policy_requires_deposit
      and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0
      and configured_salon.booking_policy_auto_cancel_pending_deposit;
    effective_booking_policy_version := configured_salon.booking_policy_version;
    effective_booking_policy_snapshot := format(
      E'%s\nResumo: %s\nCancelamento sem atrito ate %s hora(s) antes.\nSinal exigido: %s.\nValor do sinal: %s.\nPagamento/orientacoes: %s\nConfirmacao de presenca: %s, %s min antes.\nAuto cancelamento sem confirmacao: %s, %s min antes.\nAuto cancelamento por sinal pendente: %s.\nLembrete de sinal: %s hora(s) antes.',
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
      ),
      case when configured_salon.booking_policy_confirmation_required then 'sim' else 'nao' end,
      configured_salon.booking_policy_confirmation_lead_minutes,
      case when effective_protection_auto_cancel_unconfirmed then 'sim' else 'nao' end,
      configured_salon.booking_policy_auto_cancel_lead_minutes,
      case when effective_protection_auto_cancel_pending_deposit then 'sim' else 'nao' end,
      configured_salon.booking_policy_deposit_reminder_lead_hours
    );

    if configured_salon.booking_policy_requires_deposit
      and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0 then
      effective_deposit_amount := configured_salon.booking_policy_deposit_amount;
      effective_deposit_status := 'pending';
    end if;
  end if;

  local_requested_day := (requested_date at time zone configured_salon.timezone)::date;

  select *
  into salon_schedule
  from public.get_salon_schedule_context(owner_salon_id, local_requested_day);

  if salon_schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  if not salon_schedule.is_open then
    raise exception 'salon_closed_on_selected_day';
  end if;

  if requested_date <= timezone('utc', now()) then
    raise exception 'past_time_not_allowed';
  end if;

  requested_end := requested_date + make_interval(mins => selected_service.duration);

  if requested_date < salon_schedule.opens_at_utc
    or requested_end > salon_schedule.closes_at_utc then
    raise exception 'outside_business_hours';
  end if;

  if mod(
    extract(epoch from requested_date - salon_schedule.opens_at_utc)::bigint,
    (salon_schedule.slot_step_minutes * 60)::bigint
  ) <> 0 then
    raise exception 'slot_step_mismatch';
  end if;

  select *
  into staff_schedule
  from public.get_staff_schedule_context(selected_staff.id, local_requested_day);

  if staff_schedule.staff_member_id is null
    or not coalesce(staff_schedule.is_open, false) then
    raise exception 'staff_member_closed_on_selected_day';
  end if;

  if requested_date < staff_schedule.opens_at_utc
    or requested_end > staff_schedule.closes_at_utc then
    raise exception 'staff_member_outside_business_hours';
  end if;

  if exists (
    select 1
    from public.staff_blocks sb
    where sb.staff_member_id = selected_staff.id
      and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(
        requested_date,
        requested_end,
        '[)'
      )
  ) then
    raise exception 'staff_member_blocked_time';
  end if;

  if exists (
    select 1
    from public.appointments appointment
    where appointment.staff_member_id = selected_staff.id
      and appointment.status in ('pending', 'confirmed')
      and tstzrange(appointment.date, appointment.ends_at, '[)') && tstzrange(
        requested_date,
        requested_end,
        '[)'
      )
  ) then
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
    notes,
    payment_preference,
    booking_policy_version,
    booking_policy_snapshot,
    booking_policy_acknowledged_at,
    deposit_amount,
    deposit_status,
    protection_confirmation_required,
    protection_confirmation_lead_minutes,
    protection_auto_cancel_unconfirmed,
    protection_auto_cancel_lead_minutes,
    protection_auto_cancel_pending_deposit,
    protection_deposit_reminder_lead_hours
  )
  values (
    owner_salon_id,
    target_customer.id,
    selected_service.id,
    selected_staff.id,
    requested_date,
    requested_end,
    'pending',
    normalized_notes,
    normalized_payment_preference,
    effective_booking_policy_version,
    effective_booking_policy_snapshot,
    null,
    effective_deposit_amount,
    effective_deposit_status,
    configured_salon.booking_policy_confirmation_required,
    configured_salon.booking_policy_confirmation_lead_minutes,
    effective_protection_auto_cancel_unconfirmed,
    configured_salon.booking_policy_auto_cancel_lead_minutes,
    effective_protection_auto_cancel_pending_deposit,
    configured_salon.booking_policy_deposit_reminder_lead_hours
  )
  returning * into created_appointment;

  delete from public.salon_vacancy_alerts
  where salon_id = owner_salon_id
    and service_id = selected_service.id
    and starts_at = requested_date
    and ends_at = requested_end
    and (
      staff_member_id = selected_staff.id
      or staff_member_id is null
    );

  return created_appointment;
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

grant execute on function public.create_management_appointment(uuid, uuid, timestamptz, uuid, text, text)
to authenticated;

drop function if exists public.update_management_appointment(uuid, uuid, uuid, timestamptz, uuid, text);

create or replace function public.update_management_appointment(
  appointment_uuid uuid,
  customer_uuid uuid,
  service_uuid uuid,
  requested_date timestamptz,
  staff_member_uuid uuid,
  notes_input text default null,
  payment_preference_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  target_appointment public.appointments;
  target_customer public.customers;
  selected_service public.services;
  selected_staff public.staff_members;
  configured_salon public.salons;
  salon_schedule record;
  staff_schedule record;
  updated_appointment public.appointments;
  requested_end timestamptz;
  local_requested_day date;
  normalized_notes text := nullif(btrim(coalesce(notes_input, '')), '');
  normalized_payment_preference text := nullif(btrim(coalesce(payment_preference_input, '')), '');
  effective_booking_policy_version text := null;
  effective_booking_policy_snapshot text := null;
  effective_deposit_amount numeric(10, 2) := 0;
  effective_deposit_status text := 'not_required';
  effective_protection_auto_cancel_unconfirmed boolean := false;
  effective_protection_auto_cancel_pending_deposit boolean := false;
  preserve_existing_deposit boolean := false;
begin
  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'unauthorized';
  end if;

  if normalized_payment_preference is not null
    and normalized_payment_preference not in (
      'pix',
      'cash',
      'debit_card',
      'credit_card',
      'to_be_defined'
    ) then
    raise exception 'invalid_payment_preference';
  end if;

  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid
    and salon_id = owner_salon_id;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'appointment_not_open_for_update';
  end if;

  select *
  into target_customer
  from public.customers
  where id = customer_uuid
    and salon_id = owner_salon_id;

  if target_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select *
  into selected_service
  from public.services
  where id = service_uuid
    and salon_id = owner_salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  if not selected_service.is_active then
    raise exception 'inactive_service_not_allowed';
  end if;

  select *
  into selected_staff
  from public.staff_members
  where id = staff_member_uuid
    and salon_id = owner_salon_id;

  if selected_staff.id is null then
    raise exception 'staff_member_not_found';
  end if;

  if not selected_staff.is_active then
    raise exception 'inactive_staff_member_not_allowed';
  end if;

  if not exists (
    select 1
    from public.staff_service_assignments
    where staff_member_id = selected_staff.id
      and service_id = selected_service.id
  ) then
    raise exception 'staff_member_cannot_perform_service';
  end if;

  select *
  into configured_salon
  from public.salons
  where id = owner_salon_id;

  if configured_salon.id is null then
    raise exception 'salon_not_found';
  end if;

  if configured_salon.timezone is null then
    raise exception 'schedule_not_found';
  end if;

  if configured_salon.booking_policy_enabled then
    effective_protection_auto_cancel_unconfirmed :=
      configured_salon.booking_policy_confirmation_required
      and configured_salon.booking_policy_auto_cancel_unconfirmed;
    effective_protection_auto_cancel_pending_deposit :=
      configured_salon.booking_policy_requires_deposit
      and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0
      and configured_salon.booking_policy_auto_cancel_pending_deposit;
    effective_booking_policy_version := configured_salon.booking_policy_version;
    effective_booking_policy_snapshot := format(
      E'%s\nResumo: %s\nCancelamento sem atrito ate %s hora(s) antes.\nSinal exigido: %s.\nValor do sinal: %s.\nPagamento/orientacoes: %s\nConfirmacao de presenca: %s, %s min antes.\nAuto cancelamento sem confirmacao: %s, %s min antes.\nAuto cancelamento por sinal pendente: %s.\nLembrete de sinal: %s hora(s) antes.',
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
      ),
      case when configured_salon.booking_policy_confirmation_required then 'sim' else 'nao' end,
      configured_salon.booking_policy_confirmation_lead_minutes,
      case when effective_protection_auto_cancel_unconfirmed then 'sim' else 'nao' end,
      configured_salon.booking_policy_auto_cancel_lead_minutes,
      case when effective_protection_auto_cancel_pending_deposit then 'sim' else 'nao' end,
      configured_salon.booking_policy_deposit_reminder_lead_hours
    );

    if configured_salon.booking_policy_requires_deposit
      and coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0 then
      effective_deposit_amount := configured_salon.booking_policy_deposit_amount;
      effective_deposit_status := 'pending';
    end if;
  end if;

  local_requested_day := (requested_date at time zone configured_salon.timezone)::date;

  select *
  into salon_schedule
  from public.get_salon_schedule_context(owner_salon_id, local_requested_day);

  if salon_schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  if not salon_schedule.is_open then
    raise exception 'salon_closed_on_selected_day';
  end if;

  if requested_date <= timezone('utc', now()) then
    raise exception 'past_time_not_allowed';
  end if;

  requested_end := requested_date + make_interval(mins => selected_service.duration);

  if requested_date < salon_schedule.opens_at_utc
    or requested_end > salon_schedule.closes_at_utc then
    raise exception 'outside_business_hours';
  end if;

  if mod(
    extract(epoch from requested_date - salon_schedule.opens_at_utc)::bigint,
    (salon_schedule.slot_step_minutes * 60)::bigint
  ) <> 0 then
    raise exception 'slot_step_mismatch';
  end if;

  select *
  into staff_schedule
  from public.get_staff_schedule_context(selected_staff.id, local_requested_day);

  if staff_schedule.staff_member_id is null
    or not coalesce(staff_schedule.is_open, false) then
    raise exception 'staff_member_closed_on_selected_day';
  end if;

  if requested_date < staff_schedule.opens_at_utc
    or requested_end > staff_schedule.closes_at_utc then
    raise exception 'staff_member_outside_business_hours';
  end if;

  if exists (
    select 1
    from public.staff_blocks sb
    where sb.staff_member_id = selected_staff.id
      and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(
        requested_date,
        requested_end,
        '[)'
      )
  ) then
    raise exception 'staff_member_blocked_time';
  end if;

  if exists (
    select 1
    from public.appointments appointment
    where appointment.staff_member_id = selected_staff.id
      and appointment.id <> target_appointment.id
      and appointment.status in ('pending', 'confirmed')
      and tstzrange(appointment.date, appointment.ends_at, '[)') && tstzrange(
        requested_date,
        requested_end,
        '[)'
      )
  ) then
    raise exception 'time_slot_unavailable';
  end if;

  preserve_existing_deposit :=
    target_appointment.deposit_status in ('received', 'waived', 'refunded')
    or target_appointment.deposit_paid_at is not null
    or target_appointment.deposit_customer_reported_paid_at is not null
    or target_appointment.deposit_payment_provider_charge_id is not null
    or target_appointment.deposit_receipt_path is not null;

  update public.appointments
  set
    customer_id = target_customer.id,
    service_id = selected_service.id,
    staff_member_id = selected_staff.id,
    date = requested_date,
    ends_at = requested_end,
    notes = normalized_notes,
    payment_preference = normalized_payment_preference,
    booking_policy_version = effective_booking_policy_version,
    booking_policy_snapshot = effective_booking_policy_snapshot,
    booking_policy_acknowledged_at = null,
    deposit_amount = case
      when preserve_existing_deposit then target_appointment.deposit_amount
      else effective_deposit_amount
    end,
    deposit_status = case
      when preserve_existing_deposit then target_appointment.deposit_status
      else effective_deposit_status
    end,
    deposit_paid_at = case
      when preserve_existing_deposit then target_appointment.deposit_paid_at
      else null
    end,
    deposit_notes = case
      when preserve_existing_deposit then target_appointment.deposit_notes
      else null
    end,
    deposit_reminder_sent_at = null,
    deposit_customer_reported_paid_at = case
      when preserve_existing_deposit
        then target_appointment.deposit_customer_reported_paid_at
      else null
    end,
    deposit_customer_reported_paid_via = case
      when preserve_existing_deposit
        then target_appointment.deposit_customer_reported_paid_via
      else null
    end,
    deposit_customer_reported_reference = case
      when preserve_existing_deposit
        then target_appointment.deposit_customer_reported_reference
      else null
    end,
    deposit_payment_provider = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider
      else null
    end,
    deposit_payment_provider_charge_id = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_charge_id
      else null
    end,
    deposit_payment_provider_status = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_status
      else null
    end,
    deposit_payment_provider_payload = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_payload
      else null
    end,
    deposit_payment_provider_invoice_url = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_invoice_url
      else null
    end,
    deposit_payment_provider_last_synced_at = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_last_synced_at
      else null
    end,
    deposit_payment_provider_error = case
      when preserve_existing_deposit
        then target_appointment.deposit_payment_provider_error
      else null
    end,
    protection_confirmation_required =
      configured_salon.booking_policy_confirmation_required,
    protection_confirmation_lead_minutes =
      configured_salon.booking_policy_confirmation_lead_minutes,
    protection_auto_cancel_unconfirmed =
      effective_protection_auto_cancel_unconfirmed,
    protection_auto_cancel_lead_minutes =
      configured_salon.booking_policy_auto_cancel_lead_minutes,
    protection_auto_cancel_pending_deposit =
      effective_protection_auto_cancel_pending_deposit,
    protection_deposit_reminder_lead_hours =
      configured_salon.booking_policy_deposit_reminder_lead_hours,
    one_hour_reminder_sent_at = null,
    customer_confirmation_requested_at = null,
    customer_presence_confirmed_at = null
  where id = target_appointment.id
  returning * into updated_appointment;

  delete from public.salon_vacancy_alerts
  where salon_id = owner_salon_id
    and service_id = selected_service.id
    and starts_at = requested_date
    and ends_at = requested_end
    and (
      staff_member_id = selected_staff.id
      or staff_member_id is null
    );

  return updated_appointment;
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

grant execute on function public.update_management_appointment(uuid, uuid, uuid, timestamptz, uuid, text, text)
to authenticated;

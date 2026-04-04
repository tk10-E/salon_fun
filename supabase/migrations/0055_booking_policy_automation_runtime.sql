alter table public.salons
add column if not exists booking_policy_confirmation_required boolean not null default true,
add column if not exists booking_policy_confirmation_lead_minutes integer not null default 30,
add column if not exists booking_policy_auto_cancel_unconfirmed boolean not null default true,
add column if not exists booking_policy_auto_cancel_lead_minutes integer not null default 10,
add column if not exists booking_policy_auto_cancel_pending_deposit boolean not null default false,
add column if not exists booking_policy_deposit_reminder_lead_hours integer not null default 6;

alter table public.salons
drop constraint if exists salons_booking_policy_confirmation_lead_minutes_check,
drop constraint if exists salons_booking_policy_auto_cancel_lead_minutes_check,
drop constraint if exists salons_booking_policy_deposit_reminder_lead_hours_check;

alter table public.salons
add constraint salons_booking_policy_confirmation_lead_minutes_check
check (booking_policy_confirmation_lead_minutes between 5 and 180),
add constraint salons_booking_policy_auto_cancel_lead_minutes_check
check (booking_policy_auto_cancel_lead_minutes between 0 and 60),
add constraint salons_booking_policy_deposit_reminder_lead_hours_check
check (booking_policy_deposit_reminder_lead_hours between 0 and 72);

alter table public.appointments
add column if not exists protection_confirmation_required boolean not null default true,
add column if not exists protection_confirmation_lead_minutes integer not null default 30,
add column if not exists protection_auto_cancel_unconfirmed boolean not null default true,
add column if not exists protection_auto_cancel_lead_minutes integer not null default 10,
add column if not exists protection_auto_cancel_pending_deposit boolean not null default false,
add column if not exists protection_deposit_reminder_lead_hours integer not null default 6,
add column if not exists deposit_reminder_sent_at timestamptz;

alter table public.appointments
drop constraint if exists appointments_protection_confirmation_lead_minutes_check,
drop constraint if exists appointments_protection_auto_cancel_lead_minutes_check,
drop constraint if exists appointments_protection_deposit_reminder_lead_hours_check;

alter table public.appointments
add constraint appointments_protection_confirmation_lead_minutes_check
check (protection_confirmation_lead_minutes between 5 and 180),
add constraint appointments_protection_auto_cancel_lead_minutes_check
check (protection_auto_cancel_lead_minutes between 0 and 60),
add constraint appointments_protection_deposit_reminder_lead_hours_check
check (protection_deposit_reminder_lead_hours between 0 and 72);

update public.appointments appointment
set
  protection_confirmation_required = salon.booking_policy_confirmation_required,
  protection_confirmation_lead_minutes = salon.booking_policy_confirmation_lead_minutes,
  protection_auto_cancel_unconfirmed = (
    salon.booking_policy_confirmation_required
    and salon.booking_policy_auto_cancel_unconfirmed
  ),
  protection_auto_cancel_lead_minutes = salon.booking_policy_auto_cancel_lead_minutes,
  protection_auto_cancel_pending_deposit = (
    salon.booking_policy_requires_deposit
    and coalesce(salon.booking_policy_deposit_amount, 0) > 0
    and salon.booking_policy_auto_cancel_pending_deposit
  ),
  protection_deposit_reminder_lead_hours = salon.booking_policy_deposit_reminder_lead_hours
from public.salons salon
where salon.id = appointment.salon_id;

create index if not exists appointments_protection_automation_idx
on public.appointments (
  salon_id,
  status,
  date,
  deposit_status,
  deposit_reminder_sent_at,
  customer_confirmation_requested_at,
  customer_presence_confirmed_at
);

drop function if exists public.create_appointment(uuid, timestamptz, uuid, text);

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
  effective_protection_auto_cancel_unconfirmed boolean := false;
  effective_protection_auto_cancel_pending_deposit boolean := false;
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
    deposit_status,
    protection_confirmation_required,
    protection_confirmation_lead_minutes,
    protection_auto_cancel_unconfirmed,
    protection_auto_cancel_lead_minutes,
    protection_auto_cancel_pending_deposit,
    protection_deposit_reminder_lead_hours
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

create or replace function public.confirm_upcoming_appointment_presence(
  appointment_uuid uuid
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  target_appointment public.appointments;
  confirmed_appointment public.appointments;
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

  if target_appointment.status <> 'confirmed' then
    raise exception 'appointment_not_confirmed';
  end if;

  if target_appointment.date <= timezone('utc', now()) then
    raise exception 'appointment_already_started';
  end if;

  if target_appointment.customer_presence_confirmed_at is not null then
    return target_appointment;
  end if;

  if target_appointment.protection_confirmation_required
     and target_appointment.customer_confirmation_requested_at is null
     and target_appointment.date > timezone('utc', now()) + make_interval(
       mins => target_appointment.protection_confirmation_lead_minutes + 5
     ) then
    raise exception 'confirmation_not_requested';
  end if;

  update public.appointments
  set
    customer_confirmation_requested_at = coalesce(
      customer_confirmation_requested_at,
      timezone('utc', now())
    ),
    customer_presence_confirmed_at = timezone('utc', now())
  where id = target_appointment.id
  returning * into confirmed_appointment;

  return confirmed_appointment;
end;
$$;

grant execute on function public.confirm_upcoming_appointment_presence(uuid)
to authenticated;

create or replace function public.queue_due_appointment_customer_notifications(
  run_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  one_hour_queued integer := 0;
  deposit_reminder_queued integer := 0;
  confirmation_queued integer := 0;
  auto_cancelled_unconfirmed integer := 0;
  auto_cancelled_deposit_pending integer := 0;
  reminder_record record;
  local_time_label text;
  cancelled_appointment public.appointments;
begin
  for reminder_record in
    select
      appointment.id,
      appointment.salon_id,
      appointment.customer_id,
      appointment.date as appointment_starts_at,
      appointment.deposit_amount,
      coalesce(service.name, 'seu atendimento') as service_name,
      nullif(btrim(coalesce(staff_member.name, '')), '') as staff_member_name,
      coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone
    from public.appointments appointment
    join public.salons salon
      on salon.id = appointment.salon_id
    left join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.status = 'confirmed'
      and appointment.customer_id is not null
      and appointment.date > run_at
      and appointment.date <= run_at + interval '1 hour 5 minutes'
      and appointment.date > run_at + interval '30 minutes'
      and appointment.one_hour_reminder_sent_at is null
  loop
    local_time_label := to_char(
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
      'HH24:MI'
    );

    insert into public.salon_customer_notifications (
      salon_id,
      customer_id,
      audience,
      notification_type,
      title,
      body,
      payload
    )
    values (
      reminder_record.salon_id,
      reminder_record.customer_id,
      'single_customer',
      'appointment_reminder_1h',
      'Falta 1 hora para o seu horario',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Seu %s com %s comeca as %s. Programe-se para chegar com calma.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Seu %s comeca as %s. Programe-se para chegar com calma.',
            reminder_record.service_name,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_reminder_1h',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'requiresConfirmation', false
      )
    );

    update public.appointments
    set one_hour_reminder_sent_at = run_at
    where id = reminder_record.id;

    one_hour_queued := one_hour_queued + 1;
  end loop;

  for reminder_record in
    select
      appointment.id,
      appointment.salon_id,
      appointment.customer_id,
      appointment.date as appointment_starts_at,
      appointment.deposit_amount,
      coalesce(service.name, 'seu atendimento') as service_name,
      nullif(btrim(coalesce(staff_member.name, '')), '') as staff_member_name,
      coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone
    from public.appointments appointment
    join public.salons salon
      on salon.id = appointment.salon_id
    left join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.status = 'confirmed'
      and appointment.customer_id is not null
      and appointment.deposit_amount > 0
      and appointment.deposit_status = 'pending'
      and appointment.protection_deposit_reminder_lead_hours > 0
      and appointment.date > run_at + make_interval(mins => greatest(appointment.protection_auto_cancel_lead_minutes, 0))
      and appointment.date <= run_at + make_interval(hours => appointment.protection_deposit_reminder_lead_hours)
      and appointment.deposit_reminder_sent_at is null
  loop
    local_time_label := to_char(
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
      'HH24:MI'
    );

    insert into public.salon_customer_notifications (
      salon_id,
      customer_id,
      audience,
      notification_type,
      title,
      body,
      payload
    )
    values (
      reminder_record.salon_id,
      reminder_record.customer_id,
      'single_customer',
      'appointment_deposit_required',
      'Regularize o sinal da sua reserva',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Seu %s com %s as %s ainda esta com sinal pendente de R$ %s. Regularize com o salao para manter a reserva protegida.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label,
            to_char(reminder_record.deposit_amount, 'FM999999990.00')
          )
        else
          format(
            'Seu %s as %s ainda esta com sinal pendente de R$ %s. Regularize com o salao para manter a reserva protegida.',
            reminder_record.service_name,
            local_time_label,
            to_char(reminder_record.deposit_amount, 'FM999999990.00')
          )
      end,
      jsonb_build_object(
        'type', 'appointment_deposit_required',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'depositAmount', reminder_record.deposit_amount
      )
    );

    update public.appointments
    set deposit_reminder_sent_at = run_at
    where id = reminder_record.id;

    deposit_reminder_queued := deposit_reminder_queued + 1;
  end loop;

  for reminder_record in
    select
      appointment.id,
      appointment.salon_id,
      appointment.customer_id,
      appointment.date as appointment_starts_at,
      coalesce(service.name, 'seu atendimento') as service_name,
      nullif(btrim(coalesce(staff_member.name, '')), '') as staff_member_name,
      coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone
    from public.appointments appointment
    join public.salons salon
      on salon.id = appointment.salon_id
    left join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.status = 'confirmed'
      and appointment.customer_id is not null
      and appointment.protection_confirmation_required
      and appointment.date > run_at
      and appointment.date <= run_at + make_interval(mins => appointment.protection_confirmation_lead_minutes + 5)
      and appointment.customer_presence_confirmed_at is null
      and appointment.customer_confirmation_requested_at is null
  loop
    local_time_label := to_char(
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
      'HH24:MI'
    );

    insert into public.salon_customer_notifications (
      salon_id,
      customer_id,
      audience,
      notification_type,
      title,
      body,
      payload
    )
    values (
      reminder_record.salon_id,
      reminder_record.customer_id,
      'single_customer',
      'appointment_confirmation_required',
      'Confirme sua presenca no salao',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Faltam %s minutos para %s com %s as %s. Confirme presenca ou cancele para liberar o horario.',
            greatest(1, (
              extract(epoch from reminder_record.appointment_starts_at - run_at) / 60
            )::integer),
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Faltam %s minutos para %s as %s. Confirme presenca ou cancele para liberar o horario.',
            greatest(1, (
              extract(epoch from reminder_record.appointment_starts_at - run_at) / 60
            )::integer),
            reminder_record.service_name,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_confirmation_required',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'requiresConfirmation', true
      )
    );

    update public.appointments
    set customer_confirmation_requested_at = run_at
    where id = reminder_record.id;

    confirmation_queued := confirmation_queued + 1;
  end loop;

  for reminder_record in
    select
      appointment.id,
      appointment.salon_id,
      appointment.customer_id,
      appointment.date as appointment_starts_at,
      coalesce(service.name, 'seu atendimento') as service_name,
      nullif(btrim(coalesce(staff_member.name, '')), '') as staff_member_name,
      coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone
    from public.appointments appointment
    join public.salons salon
      on salon.id = appointment.salon_id
    left join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.status = 'confirmed'
      and appointment.customer_id is not null
      and appointment.protection_auto_cancel_unconfirmed
      and appointment.customer_confirmation_requested_at is not null
      and appointment.customer_presence_confirmed_at is null
      and appointment.date <= run_at + make_interval(mins => appointment.protection_auto_cancel_lead_minutes)
      and appointment.date >= run_at - interval '10 minutes'
  loop
    update public.appointments
    set
      status = 'cancelled',
      cancelled_at = run_at,
      cancelled_by = 'system',
      cancellation_reason = 'Cancelado automaticamente por falta de confirmacao perto do horario.',
      completed_at = null
    where id = reminder_record.id
      and status = 'confirmed'
      and customer_presence_confirmed_at is null
    returning * into cancelled_appointment;

    if cancelled_appointment.id is null then
      continue;
    end if;

    if cancelled_appointment.date > run_at then
      perform public.create_vacancy_alert_for_appointment(cancelled_appointment.id, 'system');
    end if;

    local_time_label := to_char(
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
      'HH24:MI'
    );

    insert into public.salon_customer_notifications (
      salon_id,
      customer_id,
      audience,
      notification_type,
      title,
      body,
      payload
    )
    values (
      reminder_record.salon_id,
      reminder_record.customer_id,
      'single_customer',
      'appointment_auto_cancelled_unconfirmed',
      'Horario cancelado por falta de confirmacao',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Como sua presenca nao foi confirmada a tempo, o horario de %s com %s as %s foi liberado para a agenda do salao.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Como sua presenca nao foi confirmada a tempo, o horario de %s as %s foi liberado para a agenda do salao.',
            reminder_record.service_name,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_auto_cancelled_unconfirmed',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'requiresConfirmation', false
      )
    );

    auto_cancelled_unconfirmed := auto_cancelled_unconfirmed + 1;
  end loop;

  for reminder_record in
    select
      appointment.id,
      appointment.salon_id,
      appointment.customer_id,
      appointment.date as appointment_starts_at,
      appointment.deposit_amount,
      coalesce(service.name, 'seu atendimento') as service_name,
      nullif(btrim(coalesce(staff_member.name, '')), '') as staff_member_name,
      coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone
    from public.appointments appointment
    join public.salons salon
      on salon.id = appointment.salon_id
    left join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
    where appointment.status = 'confirmed'
      and appointment.customer_id is not null
      and appointment.protection_auto_cancel_pending_deposit
      and appointment.deposit_amount > 0
      and appointment.deposit_status = 'pending'
      and appointment.date <= run_at + make_interval(mins => appointment.protection_auto_cancel_lead_minutes)
      and appointment.date >= run_at - interval '10 minutes'
  loop
    update public.appointments
    set
      status = 'cancelled',
      cancelled_at = run_at,
      cancelled_by = 'system',
      cancellation_reason = 'Cancelado automaticamente porque o sinal da reserva nao foi regularizado a tempo.',
      completed_at = null
    where id = reminder_record.id
      and status = 'confirmed'
      and deposit_status = 'pending'
    returning * into cancelled_appointment;

    if cancelled_appointment.id is null then
      continue;
    end if;

    if cancelled_appointment.date > run_at then
      perform public.create_vacancy_alert_for_appointment(cancelled_appointment.id, 'system');
    end if;

    local_time_label := to_char(
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
      'HH24:MI'
    );

    insert into public.salon_customer_notifications (
      salon_id,
      customer_id,
      audience,
      notification_type,
      title,
      body,
      payload
    )
    values (
      reminder_record.salon_id,
      reminder_record.customer_id,
      'single_customer',
      'appointment_auto_cancelled_deposit_pending',
      'Horario cancelado por sinal pendente',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Como o sinal de R$ %s nao foi regularizado a tempo, o horario de %s com %s as %s foi liberado para a agenda do salao.',
            to_char(reminder_record.deposit_amount, 'FM999999990.00'),
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Como o sinal de R$ %s nao foi regularizado a tempo, o horario de %s as %s foi liberado para a agenda do salao.',
            to_char(reminder_record.deposit_amount, 'FM999999990.00'),
            reminder_record.service_name,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_auto_cancelled_deposit_pending',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'depositAmount', reminder_record.deposit_amount
      )
    );

    auto_cancelled_deposit_pending := auto_cancelled_deposit_pending + 1;
  end loop;

  return jsonb_build_object(
    'processedAt', run_at,
    'oneHourQueued', one_hour_queued,
    'depositReminderQueued', deposit_reminder_queued,
    'confirmationQueued', confirmation_queued,
    'autoCancelledUnconfirmed', auto_cancelled_unconfirmed,
    'autoCancelledDepositPending', auto_cancelled_deposit_pending
  );
end;
$$;

select public.queue_due_appointment_customer_notifications(timezone('utc', now()));

alter table public.appointments
add column if not exists day_before_reminder_sent_at timestamptz,
add column if not exists three_hour_reminder_sent_at timestamptz,
add column if not exists fifteen_minute_reminder_sent_at timestamptz;

create or replace function public.reset_appointment_notification_runtime()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if
    new.date is distinct from old.date
    or new.ends_at is distinct from old.ends_at
    or new.staff_member_id is distinct from old.staff_member_id
    or new.service_id is distinct from old.service_id
    or new.customer_id is distinct from old.customer_id
    or new.status is distinct from old.status
  then
    new.day_before_reminder_sent_at := null;
    new.three_hour_reminder_sent_at := null;
    new.one_hour_reminder_sent_at := null;
    new.fifteen_minute_reminder_sent_at := null;
    new.deposit_reminder_sent_at := null;
    new.customer_confirmation_requested_at := null;
    new.customer_presence_confirmed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_reset_notification_runtime
on public.appointments;

create trigger appointments_reset_notification_runtime
before update on public.appointments
for each row
execute function public.reset_appointment_notification_runtime();

create or replace function public.queue_due_appointment_customer_notifications(
  run_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  day_before_queued integer := 0;
  three_hour_queued integer := 0;
  one_hour_queued integer := 0;
  fifteen_minute_queued integer := 0;
  deposit_reminder_queued integer := 0;
  confirmation_queued integer := 0;
  auto_cancelled_unconfirmed integer := 0;
  auto_cancelled_deposit_pending integer := 0;
  reminder_record record;
  local_time_label text;
  local_day_label text;
  run_local_date date;
  appointment_local_date date;
  cancelled_appointment public.appointments;
begin
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
      and appointment.date > run_at + interval '12 hours'
      and appointment.date <= run_at + interval '24 hours 5 minutes'
      and appointment.day_before_reminder_sent_at is null
  loop
    local_time_label := to_char(
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
      'HH24:MI'
    );
    run_local_date := (run_at at time zone reminder_record.salon_timezone)::date;
    appointment_local_date := (
      reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone
    )::date;
    local_day_label := case
      when appointment_local_date = run_local_date then 'hoje'
      when appointment_local_date = run_local_date + 1 then 'amanhã'
      else to_char(
        reminder_record.appointment_starts_at at time zone reminder_record.salon_timezone,
        'DD/MM'
      )
    end;

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
      'appointment_reminder_24h',
      'Lembrete do seu horário',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Seu %s com %s está marcado para %s às %s. Se precisar ajustar algo, faça pelo app com antecedência.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_day_label,
            local_time_label
          )
        else
          format(
            'Seu %s está marcado para %s às %s. Se precisar ajustar algo, faça pelo app com antecedência.',
            reminder_record.service_name,
            local_day_label,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_reminder_24h',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'requiresConfirmation', false
      )
    );

    update public.appointments
    set day_before_reminder_sent_at = run_at
    where id = reminder_record.id;

    day_before_queued := day_before_queued + 1;
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
      and appointment.date > run_at + interval '1 hour'
      and appointment.date <= run_at + interval '3 hours 5 minutes'
      and appointment.three_hour_reminder_sent_at is null
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
      'appointment_reminder_3h',
      'Faltam 3 horas para o seu horário',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Seu %s com %s começa às %s. Vale se organizar para chegar sem correria.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Seu %s começa às %s. Vale se organizar para chegar sem correria.',
            reminder_record.service_name,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_reminder_3h',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'requiresConfirmation', false
      )
    );

    update public.appointments
    set three_hour_reminder_sent_at = run_at
    where id = reminder_record.id;

    three_hour_queued := three_hour_queued + 1;
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
      'Falta 1 hora para o seu horário',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Seu %s com %s começa às %s. Programe-se para chegar com calma.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Seu %s começa às %s. Programe-se para chegar com calma.',
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
            'Seu %s com %s às %s ainda está com sinal pendente de R$ %s. Regularize com o salão para manter a reserva protegida.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label,
            to_char(reminder_record.deposit_amount, 'FM999999990.00')
          )
        else
          format(
            'Seu %s às %s ainda está com sinal pendente de R$ %s. Regularize com o salão para manter a reserva protegida.',
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
      'Confirme sua presença no salão',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Faltam %s minutos para %s com %s às %s. Confirme presença ou cancele para liberar o horário.',
            greatest(1, (
              extract(epoch from reminder_record.appointment_starts_at - run_at) / 60
            )::integer),
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Faltam %s minutos para %s às %s. Confirme presença ou cancele para liberar o horário.',
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
      and appointment.date > run_at + interval '5 minutes'
      and appointment.date <= run_at + interval '15 minutes'
      and appointment.fifteen_minute_reminder_sent_at is null
      and (
        not coalesce(appointment.protection_confirmation_required, false)
        or appointment.customer_presence_confirmed_at is not null
      )
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
      'appointment_reminder_15m',
      'Seu horário começa em 15 minutos',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Seu %s com %s começa às %s. Aproveite para ir se preparando sem pressa.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Seu %s começa às %s. Aproveite para ir se preparando sem pressa.',
            reminder_record.service_name,
            local_time_label
          )
      end,
      jsonb_build_object(
        'type', 'appointment_reminder_15m',
        'appointmentId', reminder_record.id,
        'appointmentAt', reminder_record.appointment_starts_at,
        'serviceName', reminder_record.service_name,
        'staffMemberName', reminder_record.staff_member_name,
        'requiresConfirmation', false
      )
    );

    update public.appointments
    set fifteen_minute_reminder_sent_at = run_at
    where id = reminder_record.id;

    fifteen_minute_queued := fifteen_minute_queued + 1;
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
      cancellation_reason = 'Cancelado automaticamente por falta de confirmação perto do horário.',
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
      'Horário cancelado por falta de confirmação',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Como sua presença não foi confirmada a tempo, o horário de %s com %s às %s foi liberado para a agenda do salão.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Como sua presença não foi confirmada a tempo, o horário de %s às %s foi liberado para a agenda do salão.',
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
      cancellation_reason = 'Cancelado automaticamente porque o sinal da reserva não foi regularizado a tempo.',
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
      'Horário cancelado por sinal pendente',
      case
        when reminder_record.staff_member_name is not null then
          format(
            'Como o sinal de R$ %s não foi regularizado a tempo, o horário de %s com %s às %s foi liberado para a agenda do salão.',
            to_char(reminder_record.deposit_amount, 'FM999999990.00'),
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Como o sinal de R$ %s não foi regularizado a tempo, o horário de %s às %s foi liberado para a agenda do salão.',
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
    'dayBeforeQueued', day_before_queued,
    'threeHourQueued', three_hour_queued,
    'oneHourQueued', one_hour_queued,
    'fifteenMinuteQueued', fifteen_minute_queued,
    'depositReminderQueued', deposit_reminder_queued,
    'confirmationQueued', confirmation_queued,
    'autoCancelledUnconfirmed', auto_cancelled_unconfirmed,
    'autoCancelledDepositPending', auto_cancelled_deposit_pending
  );
end;
$$;

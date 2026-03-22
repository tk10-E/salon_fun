do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'appointments_cancelled_by_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
    drop constraint appointments_cancelled_by_check;
  end if;

  alter table public.appointments
  add constraint appointments_cancelled_by_check
  check (
    cancelled_by is null
    or cancelled_by in ('customer', 'salon', 'system')
  );
end;
$$;

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
  confirmation_queued integer := 0;
  auto_cancelled integer := 0;
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
      and appointment.date <= run_at + interval '35 minutes'
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
            'Faltam 30 minutos para %s com %s às %s. Confirme presença ou cancele para liberar o horário.',
            reminder_record.service_name,
            reminder_record.staff_member_name,
            local_time_label
          )
        else
          format(
            'Faltam 30 minutos para %s às %s. Confirme presença ou cancele para liberar o horário.',
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
      and appointment.customer_confirmation_requested_at is not null
      and appointment.customer_presence_confirmed_at is null
      and appointment.date <= run_at + interval '10 minutes'
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
      perform public.create_vacancy_alert_for_appointment(cancelled_appointment.id, 'salon');
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

    auto_cancelled := auto_cancelled + 1;
  end loop;

  return jsonb_build_object(
    'processedAt', run_at,
    'oneHourQueued', one_hour_queued,
    'confirmationQueued', confirmation_queued,
    'autoCancelled', auto_cancelled
  );
end;
$$;

select public.queue_due_appointment_customer_notifications(timezone('utc', now()));

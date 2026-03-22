alter table public.appointments
add column if not exists one_hour_reminder_sent_at timestamptz,
add column if not exists customer_confirmation_requested_at timestamptz,
add column if not exists customer_presence_confirmed_at timestamptz;

create index if not exists appointments_confirmation_tracking_idx
on public.appointments (
  salon_id,
  status,
  date,
  customer_confirmation_requested_at,
  customer_presence_confirmed_at
);

do $publication$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    begin
      alter publication supabase_realtime add table public.appointments;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end;
$publication$;

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

  if target_appointment.customer_confirmation_requested_at is null
     and target_appointment.date > timezone('utc', now()) + interval '35 minutes' then
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

grant execute on function public.confirm_upcoming_appointment_presence(uuid) to authenticated;

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
  reminder_record record;
  local_time_label text;
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

  return jsonb_build_object(
    'processedAt', run_at,
    'oneHourQueued', one_hour_queued,
    'confirmationQueued', confirmation_queued
  );
end;
$$;

do $scheduler$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      null;
  end;

  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'dispatch-appointment-reminders';
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'dispatch-appointment-reminders',
      '*/5 * * * *',
      $job$select public.queue_due_appointment_customer_notifications(timezone('utc', now()));$job$
    );
  end if;
exception
  when others then
    null;
end;
$scheduler$;

select public.queue_due_appointment_customer_notifications(timezone('utc', now()));

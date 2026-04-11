alter table private.customer_growth_automation_runs
  drop constraint if exists customer_growth_automation_runs_automation_type_check;

alter table private.customer_growth_automation_runs
  add constraint customer_growth_automation_runs_automation_type_check
  check (automation_type in ('winback_offer', 'smart_rebook_prompt', 'haircut_rebook_reminder'));

create or replace function public.is_haircut_rebook_service(
  service_name text,
  service_category text default null
)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select trim(
      concat_ws(
        ' ',
        public.normalize_growth_text(service_category),
        public.normalize_growth_text(service_name)
      )
    ) as value
  )
  select
    value like '%corte%'
    or value like '%haircut%'
    or value like '%fade%'
    or value like '%degrade%'
    or value like '%navalhado%'
    or value like '%tesoura%'
  from normalized;
$$;

create or replace function public.queue_due_haircut_rebook_notifications(
  run_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  reminder_record record;
  queued_count integer := 0;
  automation_run_id uuid;
  queued_notification_id uuid;
begin
  for reminder_record in
    with completed_haircuts as (
      select
        appointment.customer_id,
        appointment.salon_id,
        appointment.id as appointment_id,
        coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
        service.id as service_id,
        coalesce(service.name, 'corte') as service_name,
        service.category as service_category,
        coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone,
        row_number() over (
          partition by appointment.customer_id
          order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
        ) as row_number
      from public.appointments appointment
      join public.services service
        on service.id = appointment.service_id
      join public.salons salon
        on salon.id = appointment.salon_id
      where appointment.status = 'completed'
        and appointment.customer_id is not null
        and public.is_haircut_rebook_service(service.name, service.category)
    ),
    due_haircuts as (
      select
        customer.id as customer_id,
        customer.salon_id,
        coalesce(nullif(btrim(customer.name), ''), 'cliente') as customer_name,
        completed_haircuts.appointment_id as last_completed_appointment_id,
        completed_haircuts.service_id,
        completed_haircuts.service_name,
        completed_haircuts.service_category,
        completed_haircuts.last_visit_at,
        completed_haircuts.salon_timezone,
        greatest(
          0,
          (run_at at time zone completed_haircuts.salon_timezone)::date
          - (completed_haircuts.last_visit_at at time zone completed_haircuts.salon_timezone)::date
        )::integer as inactive_days
      from public.customers customer
      join completed_haircuts
        on completed_haircuts.customer_id = customer.id
       and completed_haircuts.row_number = 1
      left join public.salon_growth_automation_settings settings
        on settings.salon_id = customer.salon_id
      where coalesce(settings.smart_rebook_is_active, true)
        and greatest(
          0,
          (run_at at time zone completed_haircuts.salon_timezone)::date
          - (completed_haircuts.last_visit_at at time zone completed_haircuts.salon_timezone)::date
        ) >= 14
        and not exists (
          select 1
          from public.appointments upcoming
          join public.services upcoming_service
            on upcoming_service.id = upcoming.service_id
          where upcoming.customer_id = customer.id
            and upcoming.salon_id = customer.salon_id
            and upcoming.status in ('pending', 'confirmed')
            and upcoming.date >= run_at
            and public.is_haircut_rebook_service(
              upcoming_service.name,
              upcoming_service.category
            )
        )
        and not exists (
          select 1
          from private.customer_growth_automation_runs automation_run
          where automation_run.automation_type = 'haircut_rebook_reminder'
            and automation_run.customer_id = customer.id
            and automation_run.last_completed_appointment_id = completed_haircuts.appointment_id
        )
    )
    select *
    from due_haircuts
    order by last_visit_at asc
  loop
    automation_run_id := null;
    queued_notification_id := null;

    insert into private.customer_growth_automation_runs (
      automation_type,
      salon_id,
      customer_id,
      notification_id,
      last_completed_appointment_id,
      payload,
      sent_at
    )
    values (
      'haircut_rebook_reminder',
      reminder_record.salon_id,
      reminder_record.customer_id,
      null,
      reminder_record.last_completed_appointment_id,
      jsonb_build_object(
        'inactiveDays', reminder_record.inactive_days,
        'recommendedIntervalDays', 14,
        'serviceId', reminder_record.service_id,
        'serviceName', reminder_record.service_name,
        'serviceCategory', reminder_record.service_category,
        'lastVisitAt', reminder_record.last_visit_at
      ),
      run_at
    )
    on conflict (automation_type, customer_id, last_completed_appointment_id) do nothing
    returning id into automation_run_id;

    if automation_run_id is null then
      continue;
    end if;

    begin
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
        'haircut_rebook_reminder',
        'Seu corte já está pedindo retorno',
        left(
          format(
            '%s, já se passaram %s dias desde seu último %s. Quer reservar seu próximo horário pelo app?',
            reminder_record.customer_name,
            greatest(reminder_record.inactive_days, 14),
            reminder_record.service_name
          ),
          280
        ),
        jsonb_build_object(
          'type', 'haircut_rebook_reminder',
          'ctaTarget', 'appointments',
          'inactiveDays', reminder_record.inactive_days,
          'recommendedIntervalDays', 14,
          'lastCompletedAppointmentId', reminder_record.last_completed_appointment_id,
          'lastVisitAt', reminder_record.last_visit_at,
          'recommendedServiceId', reminder_record.service_id,
          'recommendedServiceName', reminder_record.service_name
        )
      )
      returning id into queued_notification_id;

      update private.customer_growth_automation_runs
      set notification_id = queued_notification_id
      where id = automation_run_id;
    exception
      when others then
        delete from private.customer_growth_automation_runs
        where id = automation_run_id;

        raise log 'queue_due_haircut_rebook_notifications failed for customer %: %', reminder_record.customer_id, sqlerrm;
        continue;
    end;

    queued_count := queued_count + 1;
  end loop;

  return jsonb_build_object(
    'processedAt', run_at,
    'haircutRebookQueued', queued_count
  );
end;
$$;

revoke all on function public.queue_due_haircut_rebook_notifications(timestamptz) from public, anon;
grant execute on function public.queue_due_haircut_rebook_notifications(timestamptz) to authenticated, service_role;

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
      where jobname = 'dispatch-haircut-rebook-reminders';
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'dispatch-haircut-rebook-reminders',
      '20 12 * * *',
      $job$select public.queue_due_haircut_rebook_notifications(timezone('utc', now()));$job$
    );
  end if;
exception
  when others then
    null;
end;
$scheduler$;

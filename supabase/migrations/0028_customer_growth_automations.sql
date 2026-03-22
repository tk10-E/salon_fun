create schema if not exists private;

create table if not exists private.customer_growth_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_type text not null check (automation_type in ('winback_offer')),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  notification_id uuid references public.salon_customer_notifications (id) on delete set null,
  last_completed_appointment_id uuid references public.appointments (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  check (jsonb_typeof(payload) = 'object'),
  unique (automation_type, customer_id, last_completed_appointment_id)
);

create index if not exists customer_growth_automation_runs_customer_idx
on private.customer_growth_automation_runs (
  automation_type,
  customer_id,
  sent_at desc
);

create index if not exists customer_growth_automation_runs_salon_idx
on private.customer_growth_automation_runs (
  salon_id,
  sent_at desc
);

revoke all on table private.customer_growth_automation_runs from public, anon, authenticated;

create or replace function public.normalize_growth_text(value text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(value, '')),
        'áàãâäéèêëíìîïóòõôöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.detect_service_growth_segment(
  service_name text,
  service_category text default null
)
returns text
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
  select case
    when value like '%barba%' or value like '%beard%' then 'barba'
    when value like '%corte%' or value like '%haircut%' or value like '%fade%' or value like '%degrade%' then 'corte'
    when value like '%manicure%' or value like '%mao%' or value like '%unha%' then 'manicure'
    when value like '%pedicure%'
      or value like 'pe %'
      or value like '% pe %'
      or value like '% pe'
      or value like '% pes %' then 'pedicure'
    when value like '%color%' or value like '%tintura%' or value like '%luzes%' or value like '%mechas%' or value like '%pintura%' then 'coloracao'
    when value like '%hidrat%' or value like '%tratamento%' or value like '%reconstr%' or value like '%botox%' or value like '%selagem%' or value like '%progressiva%' then 'tratamento'
    when value like '%sobrancel%' then 'sobrancelha'
    when value like '%cilios%' or value like '%lash%' then 'cilios'
    else 'geral'
  end
  from normalized;
$$;

create or replace function public.infer_service_revisit_interval_days(
  service_name text,
  service_category text default null
)
returns integer
language sql
immutable
as $$
  select case public.detect_service_growth_segment(service_name, service_category)
    when 'barba' then 15
    when 'corte' then 30
    when 'coloracao' then 45
    when 'tratamento' then 21
    when 'manicure' then 21
    when 'pedicure' then 28
    when 'sobrancelha' then 21
    when 'cilios' then 21
    else 30
  end;
$$;

create or replace function public.combo_target_growth_segment(base_segment text)
returns text
language sql
immutable
as $$
  select case coalesce(base_segment, '')
    when 'barba' then 'corte'
    when 'corte' then 'barba'
    when 'manicure' then 'pedicure'
    when 'pedicure' then 'manicure'
    when 'coloracao' then 'tratamento'
    when 'tratamento' then 'corte'
    when 'sobrancelha' then 'cilios'
    when 'cilios' then 'sobrancelha'
    else null
  end;
$$;

create or replace function public.get_customer_growth_suggestions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  salon_timezone text := 'America/Sao_Paulo';
  last_visit record;
  has_upcoming_appointment boolean := false;
  has_same_segment_upcoming boolean := false;
  recommended_interval_days integer := 30;
  recommended_booking_date timestamptz;
  inactive_days integer := 0;
  incentive_percent integer := 0;
  combo_target_segment text;
  combo_service record;
  suggestions jsonb := '[]'::jsonb;
  rebooking_suggestion jsonb;
  combo_suggestion jsonb;
  urgency text := 'plan_ahead';
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid()
  limit 1;

  if customer_profile.id is null then
    return jsonb_build_object(
      'has_visible_content', false,
      'generated_at', timezone('utc', now()),
      'suggestions', '[]'::jsonb
    );
  end if;

  select coalesce(timezone, 'America/Sao_Paulo')
  into salon_timezone
  from public.salons
  where id = customer_profile.salon_id
  limit 1;

  select
    appointment.id as appointment_id,
    service.id as service_id,
    coalesce(service.name, 'seu atendimento') as service_name,
    service.category as service_category,
    service.price as service_price,
    service.duration as service_duration,
    coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
    public.detect_service_growth_segment(service.name, service.category) as service_segment
  into last_visit
  from public.appointments appointment
  join public.services service
    on service.id = appointment.service_id
  where appointment.customer_id = customer_profile.id
    and appointment.status = 'completed'
  order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
  limit 1;

  if last_visit.appointment_id is null then
    return jsonb_build_object(
      'has_visible_content', false,
      'generated_at', timezone('utc', now()),
      'suggestions', '[]'::jsonb
    );
  end if;

  select exists (
    select 1
    from public.appointments appointment
    where appointment.customer_id = customer_profile.id
      and appointment.status in ('pending', 'confirmed')
      and appointment.date >= timezone('utc', now())
  )
  into has_upcoming_appointment;

  inactive_days := greatest(
    0,
    (timezone('utc', now()) at time zone salon_timezone)::date
    - (last_visit.last_visit_at at time zone salon_timezone)::date
  );

  recommended_interval_days := public.infer_service_revisit_interval_days(
    last_visit.service_name,
    last_visit.service_category
  );
  recommended_booking_date := last_visit.last_visit_at + make_interval(days => recommended_interval_days);

  select exists (
    select 1
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.customer_id = customer_profile.id
      and appointment.status in ('pending', 'confirmed')
      and appointment.date >= timezone('utc', now())
      and public.detect_service_growth_segment(service.name, service.category) = last_visit.service_segment
  )
  into has_same_segment_upcoming;

  if not has_upcoming_appointment and not has_same_segment_upcoming then
    urgency := case
      when recommended_booking_date <= timezone('utc', now()) then 'due_now'
      when recommended_booking_date <= timezone('utc', now()) + interval '10 days' then 'due_soon'
      else 'plan_ahead'
    end;

    incentive_percent := case
      when inactive_days >= 30 then 10
      else 0
    end;

    rebooking_suggestion := jsonb_strip_nulls(
      jsonb_build_object(
        'id', 'rebooking:' || last_visit.service_id,
        'type', 'rebooking',
        'service_id', last_visit.service_id,
        'service_name', last_visit.service_name,
        'service_category', last_visit.service_category,
        'service_price', last_visit.service_price,
        'service_duration', last_visit.service_duration,
        'based_on_service_name', last_visit.service_name,
        'last_visit_at', last_visit.last_visit_at,
        'recommended_interval_days', recommended_interval_days,
        'recommended_booking_date', recommended_booking_date,
        'urgency', urgency,
        'inactive_days', inactive_days,
        'incentive_percent', case when incentive_percent > 0 then incentive_percent else null end
      )
    );

    suggestions := suggestions || jsonb_build_array(rebooking_suggestion);
  end if;

  combo_target_segment := public.combo_target_growth_segment(last_visit.service_segment);

  if not has_upcoming_appointment and combo_target_segment is not null then
    select
      service.id as service_id,
      coalesce(service.name, 'serviço complementar') as service_name,
      service.category as service_category,
      service.price as service_price,
      service.duration as service_duration
    into combo_service
    from public.services service
    where service.salon_id = customer_profile.salon_id
      and service.id <> last_visit.service_id
      and public.detect_service_growth_segment(service.name, service.category) = combo_target_segment
      and not exists (
        select 1
        from public.appointments appointment
        where appointment.customer_id = customer_profile.id
          and appointment.service_id = service.id
          and appointment.status in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )
    order by service.sort_order asc, service.price asc, service.name asc
    limit 1;

    if combo_service.service_id is not null then
      combo_suggestion := jsonb_strip_nulls(
        jsonb_build_object(
          'id', 'combo:' || combo_service.service_id,
          'type', 'combo',
          'service_id', combo_service.service_id,
          'service_name', combo_service.service_name,
          'service_category', combo_service.service_category,
          'service_price', combo_service.service_price,
          'service_duration', combo_service.service_duration,
          'based_on_service_name', last_visit.service_name,
          'last_visit_at', last_visit.last_visit_at,
          'recommended_interval_days', null,
          'recommended_booking_date', null,
          'urgency', 'cross_sell',
          'inactive_days', inactive_days,
          'incentive_percent', null
        )
      );

      suggestions := suggestions || jsonb_build_array(combo_suggestion);
    end if;
  end if;

  return jsonb_build_object(
    'has_visible_content', jsonb_array_length(suggestions) > 0,
    'generated_at', timezone('utc', now()),
    'last_visit_service_name', last_visit.service_name,
    'last_visit_at', last_visit.last_visit_at,
    'inactive_days', inactive_days,
    'suggestions', suggestions
  );
end;
$$;

grant execute on function public.get_customer_growth_suggestions() to authenticated;

create or replace function public.queue_due_customer_growth_notifications(
  run_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  winback_record record;
  queued_count integer := 0;
  inactive_days integer := 0;
  automation_run_id uuid;
  queued_notification_id uuid;
begin
  for winback_record in
    with completed_visits as (
      select
        appointment.customer_id,
        appointment.salon_id,
        appointment.id as appointment_id,
        coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
        service.id as service_id,
        coalesce(service.name, 'seu atendimento') as service_name,
        service.category as service_category,
        row_number() over (
          partition by appointment.customer_id
          order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
        ) as row_number
      from public.appointments appointment
      join public.services service
        on service.id = appointment.service_id
      where appointment.status = 'completed'
    )
    select
      customer.id as customer_id,
      customer.salon_id,
      completed_visits.appointment_id as last_completed_appointment_id,
      completed_visits.service_id,
      completed_visits.service_name,
      completed_visits.service_category,
      completed_visits.last_visit_at,
      greatest(
        0,
        (run_at at time zone coalesce(salon.timezone, 'America/Sao_Paulo'))::date
        - (completed_visits.last_visit_at at time zone coalesce(salon.timezone, 'America/Sao_Paulo'))::date
      )::integer as inactive_days
    from public.customers customer
    join public.salons salon
      on salon.id = customer.salon_id
    join completed_visits
      on completed_visits.customer_id = customer.id
     and completed_visits.row_number = 1
    where completed_visits.last_visit_at <= run_at - interval '30 days'
      and not exists (
        select 1
        from public.appointments appointment
        where appointment.customer_id = customer.id
          and appointment.status in ('pending', 'confirmed')
          and appointment.date >= run_at
      )
      and not exists (
        select 1
        from private.customer_growth_automation_runs automation_run
        where automation_run.automation_type = 'winback_offer'
          and automation_run.customer_id = customer.id
          and automation_run.last_completed_appointment_id = completed_visits.appointment_id
      )
  loop
    inactive_days := greatest(winback_record.inactive_days, 30);

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
      'winback_offer',
      winback_record.salon_id,
      winback_record.customer_id,
      null,
      winback_record.last_completed_appointment_id,
      jsonb_build_object(
        'discountPercent', 10,
        'inactiveDays', inactive_days,
        'serviceId', winback_record.service_id,
        'serviceName', winback_record.service_name
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
        winback_record.salon_id,
        winback_record.customer_id,
        'single_customer',
        'winback_offer',
        'Sentimos sua falta 😄',
        format(
          'Já faz %s dias desde seu último %s. Volte esta semana e agende com 10%% OFF pelo app.',
          inactive_days,
          winback_record.service_name
        ),
        jsonb_build_object(
          'type', 'winback_offer',
          'discountPercent', 10,
          'inactiveDays', inactive_days,
          'lastServiceName', winback_record.service_name,
          'recommendedServiceId', winback_record.service_id,
          'recommendedServiceName', winback_record.service_name,
          'recommendedIntervalDays', public.infer_service_revisit_interval_days(
            winback_record.service_name,
            winback_record.service_category
          ),
          'lastVisitAt', winback_record.last_visit_at
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

        raise log 'queue_due_customer_growth_notifications failed for customer %: %', winback_record.customer_id, sqlerrm;
        continue;
    end;

    queued_count := queued_count + 1;
  end loop;

  return jsonb_build_object(
    'processedAt', run_at,
    'winbackQueued', queued_count
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
      where jobname = 'dispatch-customer-growth-automations';
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'dispatch-customer-growth-automations',
      '15 12 * * *',
      $job$select public.queue_due_customer_growth_notifications(timezone('utc', now()));$job$
    );
  end if;
exception
  when others then
    null;
end;
$scheduler$;

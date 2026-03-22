create table if not exists public.salon_growth_automation_settings (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  is_active boolean not null default true,
  winback_inactive_days integer not null default 30,
  winback_discount_percent integer not null default 10,
  winback_title text not null default 'Sentimos sua falta 😄',
  winback_body_template text not null default 'Já faz {inactive_days} dias desde seu último {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (winback_inactive_days between 7 and 365),
  check (winback_discount_percent between 0 and 100),
  check (char_length(btrim(winback_title)) between 1 and 120),
  check (char_length(btrim(winback_body_template)) between 1 and 220)
);

create or replace function public.touch_salon_growth_automation_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_growth_automation_settings_touch_updated_at on public.salon_growth_automation_settings;

create trigger salon_growth_automation_settings_touch_updated_at
before update on public.salon_growth_automation_settings
for each row
execute function public.touch_salon_growth_automation_settings_updated_at();

alter table public.salon_growth_automation_settings enable row level security;

drop policy if exists "owners_manage_salon_growth_automation_settings" on public.salon_growth_automation_settings;

create policy "owners_manage_salon_growth_automation_settings"
on public.salon_growth_automation_settings
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create or replace function public.render_growth_notification_template(
  template_input text,
  discount_percent_input integer,
  inactive_days_input integer,
  service_name_input text
)
returns text
language sql
immutable
as $$
  select left(
    replace(
      replace(
        replace(
          coalesce(nullif(template_input, ''), ''),
          '{discount}',
          greatest(discount_percent_input, 0)::text
        ),
        '{inactive_days}',
        greatest(inactive_days_input, 0)::text
      ),
      '{service_name}',
      coalesce(nullif(service_name_input, ''), 'seu atendimento')
    ),
    280
  );
$$;

create or replace function public.get_salon_growth_automation_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  owner_salon public.salons;
  settings_payload jsonb;
  overview_payload jsonb;
  recent_runs_payload jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid()
  limit 1;

  if owner_salon.id is null then
    raise exception 'unauthorized';
  end if;

  with resolved_settings as (
    select
      coalesce(settings.is_active, true) as is_active,
      coalesce(settings.winback_inactive_days, 30) as winback_inactive_days,
      coalesce(settings.winback_discount_percent, 10) as winback_discount_percent,
      coalesce(nullif(btrim(settings.winback_title), ''), 'Sentimos sua falta 😄') as winback_title,
      coalesce(
        nullif(btrim(settings.winback_body_template), ''),
        'Já faz {inactive_days} dias desde seu último {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.'
      ) as winback_body_template,
      settings.updated_at
    from public.salons salon
    left join public.salon_growth_automation_settings settings
      on settings.salon_id = salon.id
    where salon.id = owner_salon.id
    limit 1
  )
  select jsonb_build_object(
    'is_active', is_active,
    'winback_inactive_days', winback_inactive_days,
    'winback_discount_percent', winback_discount_percent,
    'winback_title', winback_title,
    'winback_body_template', winback_body_template,
    'updated_at', updated_at
  )
  into settings_payload
  from resolved_settings;

  with resolved_settings as (
    select
      coalesce(settings.is_active, true) as is_active,
      coalesce(settings.winback_inactive_days, 30) as winback_inactive_days
    from public.salons salon
    left join public.salon_growth_automation_settings settings
      on settings.salon_id = salon.id
    where salon.id = owner_salon.id
    limit 1
  ),
  completed_visits as (
    select
      appointment.customer_id,
      appointment.id as appointment_id,
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
      row_number() over (
        partition by appointment.customer_id
        order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
      ) as row_number
    from public.appointments appointment
    where appointment.salon_id = owner_salon.id
      and appointment.status = 'completed'
  ),
  customer_activity as (
    select
      customer.id as customer_id,
      completed_visits.appointment_id,
      greatest(
        0,
        (timezone('utc', now()) at time zone coalesce(owner_salon.timezone, 'America/Sao_Paulo'))::date
        - (completed_visits.last_visit_at at time zone coalesce(owner_salon.timezone, 'America/Sao_Paulo'))::date
      )::integer as inactive_days
    from public.customers customer
    join completed_visits
      on completed_visits.customer_id = customer.id
     and completed_visits.row_number = 1
    where customer.salon_id = owner_salon.id
      and not exists (
        select 1
        from public.appointments appointment
        where appointment.customer_id = customer.id
          and appointment.status in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )
  )
  select jsonb_build_object(
    'at_risk_customers',
    coalesce(
      count(*) filter (
        where customer_activity.inactive_days >= greatest(7, resolved_settings.winback_inactive_days - 7)
      ),
      0
    ),
    'due_now_customers',
    coalesce(
      count(*) filter (
        where resolved_settings.is_active
          and customer_activity.inactive_days >= resolved_settings.winback_inactive_days
          and not exists (
            select 1
            from private.customer_growth_automation_runs automation_run
            where automation_run.automation_type = 'winback_offer'
              and automation_run.customer_id = customer_activity.customer_id
              and automation_run.last_completed_appointment_id = customer_activity.appointment_id
          )
      ),
      0
    ),
    'winbacks_sent_last_30d',
    (
      select count(*)::integer
      from private.customer_growth_automation_runs automation_run
      where automation_run.salon_id = owner_salon.id
        and automation_run.automation_type = 'winback_offer'
        and automation_run.sent_at >= timezone('utc', now()) - interval '30 days'
    ),
    'recovered_customers_last_30d',
    (
      select count(distinct automation_run.customer_id)::integer
      from private.customer_growth_automation_runs automation_run
      where automation_run.salon_id = owner_salon.id
        and automation_run.automation_type = 'winback_offer'
        and automation_run.sent_at >= timezone('utc', now()) - interval '30 days'
        and exists (
          select 1
          from public.appointments appointment
          where appointment.salon_id = owner_salon.id
            and appointment.customer_id = automation_run.customer_id
            and appointment.status in ('pending', 'confirmed', 'completed')
            and coalesce(appointment.created_at, appointment.date) >= automation_run.sent_at
        )
    )
  )
  into overview_payload
  from customer_activity
  cross join resolved_settings;

  with recent_runs as (
    select
      automation_run.id,
      automation_run.customer_id,
      coalesce(customer.name, 'Cliente do salão') as customer_name,
      automation_run.notification_id,
      automation_run.sent_at,
      coalesce((automation_run.payload ->> 'inactiveDays')::integer, 0) as inactive_days,
      coalesce((automation_run.payload ->> 'discountPercent')::integer, 0) as discount_percent,
      coalesce(automation_run.payload ->> 'serviceName', 'seu atendimento') as service_name,
      notification.title,
      notification.body,
      (
        select min(appointment.date)
        from public.appointments appointment
        where appointment.salon_id = owner_salon.id
          and appointment.customer_id = automation_run.customer_id
          and appointment.status in ('pending', 'confirmed', 'completed')
          and coalesce(appointment.created_at, appointment.date) >= automation_run.sent_at
      ) as recovered_appointment_at
    from private.customer_growth_automation_runs automation_run
    left join public.customers customer
      on customer.id = automation_run.customer_id
    left join public.salon_customer_notifications notification
      on notification.id = automation_run.notification_id
    where automation_run.salon_id = owner_salon.id
      and automation_run.automation_type = 'winback_offer'
    order by automation_run.sent_at desc
    limit 8
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', recent_runs.id,
        'customer_id', recent_runs.customer_id,
        'customer_name', recent_runs.customer_name,
        'notification_id', recent_runs.notification_id,
        'sent_at', recent_runs.sent_at,
        'inactive_days', recent_runs.inactive_days,
        'discount_percent', recent_runs.discount_percent,
        'service_name', recent_runs.service_name,
        'title', recent_runs.title,
        'body', recent_runs.body,
        'recovered', recent_runs.recovered_appointment_at is not null,
        'recovered_appointment_at', recent_runs.recovered_appointment_at
      )
      order by recent_runs.sent_at desc
    ),
    '[]'::jsonb
  )
  into recent_runs_payload
  from recent_runs;

  return jsonb_build_object(
    'settings', coalesce(settings_payload, '{}'::jsonb),
    'overview', coalesce(overview_payload, '{}'::jsonb),
    'recent_runs', recent_runs_payload
  );
end;
$$;

revoke all on function public.get_salon_growth_automation_dashboard() from public, anon, authenticated;
grant execute on function public.get_salon_growth_automation_dashboard() to authenticated;

create or replace function public.get_salon_notification_dispatch_snapshot(
  notification_ids_input uuid[]
)
returns table (
  notification_id uuid,
  status text,
  response_status integer,
  sent_count integer,
  failed_count integer,
  deactivated_count integer,
  error_detail text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, private
as $$
  with owner_salon as (
    select id
    from public.salons
    where owner_user_id = auth.uid()
    limit 1
  ),
  requested_ids as (
    select unnest(coalesce(notification_ids_input, array[]::uuid[])) as notification_id
  ),
  latest_dispatch as (
    select distinct on (attempt.source_record_id)
      attempt.source_record_id as notification_id,
      attempt.status,
      attempt.response_status,
      attempt.sent_count,
      attempt.failed_count,
      attempt.deactivated_count,
      attempt.error_detail,
      attempt.updated_at
    from private.push_dispatch_attempts attempt
    join requested_ids request_id
      on request_id.notification_id = attempt.source_record_id
    join public.salon_customer_notifications notification
      on notification.id = attempt.source_record_id
     and attempt.source_type = 'customer_notification'
     and notification.salon_id = attempt.salon_id
    join owner_salon
      on owner_salon.id = notification.salon_id
    order by attempt.source_record_id, attempt.updated_at desc, attempt.created_at desc
  )
  select
    latest_dispatch.notification_id,
    latest_dispatch.status,
    latest_dispatch.response_status,
    latest_dispatch.sent_count,
    latest_dispatch.failed_count,
    latest_dispatch.deactivated_count,
    latest_dispatch.error_detail,
    latest_dispatch.updated_at
  from latest_dispatch;
$$;

revoke all on function public.get_salon_notification_dispatch_snapshot(uuid[]) from public, anon, authenticated;
grant execute on function public.get_salon_notification_dispatch_snapshot(uuid[]) to authenticated;

create or replace function public.get_customer_growth_suggestions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  salon_timezone text := 'America/Sao_Paulo';
  growth_automation_active boolean := true;
  growth_inactive_days integer := 30;
  growth_discount_percent integer := 10;
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

  select
    coalesce(salon.timezone, 'America/Sao_Paulo'),
    coalesce(settings.is_active, true),
    coalesce(settings.winback_inactive_days, 30),
    coalesce(settings.winback_discount_percent, 10)
  into
    salon_timezone,
    growth_automation_active,
    growth_inactive_days,
    growth_discount_percent
  from public.salons salon
  left join public.salon_growth_automation_settings settings
    on settings.salon_id = salon.id
  where salon.id = customer_profile.salon_id
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
      when growth_automation_active and inactive_days >= growth_inactive_days then growth_discount_percent
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
      coalesce(settings.is_active, true) as growth_automation_active,
      coalesce(settings.winback_inactive_days, 30) as winback_inactive_days,
      coalesce(settings.winback_discount_percent, 10) as winback_discount_percent,
      coalesce(nullif(btrim(settings.winback_title), ''), 'Sentimos sua falta 😄') as winback_title,
      coalesce(
        nullif(btrim(settings.winback_body_template), ''),
        'Já faz {inactive_days} dias desde seu último {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.'
      ) as winback_body_template,
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
    left join public.salon_growth_automation_settings settings
      on settings.salon_id = customer.salon_id
    where coalesce(settings.is_active, true)
      and completed_visits.last_visit_at <= run_at - make_interval(days => coalesce(settings.winback_inactive_days, 30))
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
    inactive_days := greatest(winback_record.inactive_days, winback_record.winback_inactive_days);

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
        'discountPercent', winback_record.winback_discount_percent,
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
        winback_record.winback_title,
        public.render_growth_notification_template(
          winback_record.winback_body_template,
          winback_record.winback_discount_percent,
          inactive_days,
          winback_record.service_name
        ),
        jsonb_build_object(
          'type', 'winback_offer',
          'discountPercent', winback_record.winback_discount_percent,
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

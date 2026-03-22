alter table public.salon_growth_automation_settings
  add column if not exists smart_rebook_is_active boolean not null default true,
  add column if not exists smart_rebook_window_days integer not null default 4,
  add column if not exists smart_rebook_title text not null default 'Hora do seu próximo {service_name}',
  add column if not exists smart_rebook_body_template text not null default 'Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_growth_automation_settings_smart_rebook_window_days_check'
  ) then
    alter table public.salon_growth_automation_settings
      add constraint salon_growth_automation_settings_smart_rebook_window_days_check
      check (smart_rebook_window_days between 1 and 14);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_growth_automation_settings_smart_rebook_title_check'
  ) then
    alter table public.salon_growth_automation_settings
      add constraint salon_growth_automation_settings_smart_rebook_title_check
      check (char_length(btrim(smart_rebook_title)) between 1 and 120);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_growth_automation_settings_smart_rebook_body_template_check'
  ) then
    alter table public.salon_growth_automation_settings
      add constraint salon_growth_automation_settings_smart_rebook_body_template_check
      check (char_length(btrim(smart_rebook_body_template)) between 1 and 220);
  end if;
end;
$$;

alter table private.customer_growth_automation_runs
  drop constraint if exists customer_growth_automation_runs_automation_type_check;

alter table private.customer_growth_automation_runs
  add constraint customer_growth_automation_runs_automation_type_check
  check (automation_type in ('winback_offer', 'smart_rebook_prompt'));

create or replace function public.iso_weekday_label(day_input integer)
returns text
language sql
immutable
as $$
  select case day_input
    when 1 then 'na segunda'
    when 2 then 'na terça'
    when 3 then 'na quarta'
    when 4 then 'na quinta'
    when 5 then 'na sexta'
    when 6 then 'no sábado'
    when 7 then 'no domingo'
    else 'no dia ideal'
  end;
$$;

create or replace function public.growth_period_label(hour_input integer)
returns text
language sql
immutable
as $$
  select case
    when hour_input between 5 and 11 then 'de manhã'
    when hour_input between 12 and 17 then 'à tarde'
    when hour_input between 18 and 22 then 'à noite'
    else 'no horário que costuma funcionar melhor'
  end;
$$;

create or replace function public.render_smart_rebook_template(
  template_input text,
  service_name_input text,
  habit_weekday_input text,
  target_weekday_input text,
  target_period_input text,
  days_until_due_input integer,
  combo_service_name_input text default null
)
returns text
language sql
immutable
as $$
  select left(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                coalesce(nullif(template_input, ''), ''),
                '{service_name}',
                coalesce(nullif(service_name_input, ''), 'seu atendimento')
              ),
              '{habit_weekday}',
              coalesce(nullif(habit_weekday_input, ''), 'no seu melhor dia')
            ),
            '{target_weekday}',
            coalesce(nullif(target_weekday_input, ''), 'no próximo melhor horário')
          ),
          '{target_period}',
          coalesce(nullif(target_period_input, ''), 'no melhor momento para você')
        ),
        '{days_until_due}',
        greatest(days_until_due_input, 0)::text
      ),
      '{combo_service_name}',
      coalesce(nullif(combo_service_name_input, ''), 'um complemento do salão')
    ),
    280
  );
$$;

create or replace function public.align_growth_booking_to_habit(
  base_booking_at timestamptz,
  target_isodow integer,
  timezone_input text default 'America/Sao_Paulo'
)
returns timestamptz
language sql
stable
as $$
  with local_base as (
    select coalesce(base_booking_at, timezone('utc', now())) at time zone timezone_input as local_booking_at
  )
  select case
    when target_isodow between 1 and 7 then
      (
        (
          local_base.local_booking_at::date
          + (((target_isodow - extract(isodow from local_base.local_booking_at)::integer + 7) % 7) * interval '1 day')
          + local_base.local_booking_at::time
        ) at time zone timezone_input
      )::timestamptz
    else coalesce(base_booking_at, timezone('utc', now()))
  end
  from local_base;
$$;

create or replace function public.get_customer_growth_habit(
  customer_id_input uuid,
  salon_timezone_input text default 'America/Sao_Paulo',
  service_segment_input text default null
)
returns table (
  preferred_isodow integer,
  preferred_weekday_label text,
  preferred_hour integer,
  preferred_period_label text,
  sample_size integer,
  confidence text
)
language sql
stable
set search_path = public
as $$
  with visits as (
    select
      extract(
        isodow
        from coalesce(appointment.completed_at, appointment.ends_at, appointment.date)
          at time zone salon_timezone_input
      )::integer as local_isodow,
      extract(
        hour
        from coalesce(appointment.completed_at, appointment.ends_at, appointment.date)
          at time zone salon_timezone_input
      )::integer as local_hour,
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as occurred_at
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.customer_id = customer_id_input
      and appointment.status = 'completed'
      and (
        service_segment_input is null
        or public.detect_service_growth_segment(service.name, service.category) = service_segment_input
      )
    order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
    limit 6
  ),
  sample as (
    select count(*)::integer as total
    from visits
  ),
  weekday_rank as (
    select
      local_isodow,
      count(*)::integer as hits,
      row_number() over (
        order by count(*) desc, max(occurred_at) desc, local_isodow asc
      ) as row_number
    from visits
    group by local_isodow
  ),
  hour_rank as (
    select
      local_hour,
      count(*)::integer as hits,
      row_number() over (
        order by count(*) desc, local_hour asc
      ) as row_number
    from visits
    group by local_hour
  )
  select
    weekday_rank.local_isodow,
    public.iso_weekday_label(weekday_rank.local_isodow),
    hour_rank.local_hour,
    public.growth_period_label(hour_rank.local_hour),
    sample.total,
    case
      when weekday_rank.hits >= 3 then 'high'
      else 'medium'
    end
  from sample
  join weekday_rank
    on weekday_rank.row_number = 1
  join hour_rank
    on hour_rank.row_number = 1
  where sample.total >= 2
    and weekday_rank.hits >= 2;
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
      coalesce(settings.smart_rebook_is_active, true) as smart_rebook_is_active,
      coalesce(settings.smart_rebook_window_days, 4) as smart_rebook_window_days,
      coalesce(nullif(btrim(settings.smart_rebook_title), ''), 'Hora do seu próximo {service_name}') as smart_rebook_title,
      coalesce(
        nullif(btrim(settings.smart_rebook_body_template), ''),
        'Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.'
      ) as smart_rebook_body_template,
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
    'smart_rebook_is_active', smart_rebook_is_active,
    'smart_rebook_window_days', smart_rebook_window_days,
    'smart_rebook_title', smart_rebook_title,
    'smart_rebook_body_template', smart_rebook_body_template,
    'updated_at', updated_at
  )
  into settings_payload
  from resolved_settings;

  with resolved_settings as (
    select
      coalesce(settings.is_active, true) as is_active,
      coalesce(settings.winback_inactive_days, 30) as winback_inactive_days,
      coalesce(settings.smart_rebook_is_active, true) as smart_rebook_is_active,
      coalesce(settings.smart_rebook_window_days, 4) as smart_rebook_window_days
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
      service.id as service_id,
      coalesce(service.name, 'seu atendimento') as service_name,
      service.category as service_category,
      public.detect_service_growth_segment(service.name, service.category) as service_segment,
      row_number() over (
        partition by appointment.customer_id
        order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
      ) as row_number
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
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
  ),
  smart_rebook_candidates as (
    with base as (
      select
        customer.id as customer_id,
        completed_visits.appointment_id as last_completed_appointment_id,
        completed_visits.last_visit_at,
        public.infer_service_revisit_interval_days(
          completed_visits.service_name,
          completed_visits.service_category
        ) as recommended_interval_days,
        habit.preferred_isodow
      from public.customers customer
      join completed_visits
        on completed_visits.customer_id = customer.id
       and completed_visits.row_number = 1
      join resolved_settings
        on true
      join lateral public.get_customer_growth_habit(
        customer.id,
        coalesce(owner_salon.timezone, 'America/Sao_Paulo'),
        completed_visits.service_segment
      ) habit
        on resolved_settings.smart_rebook_is_active
      where customer.salon_id = owner_salon.id
        and not exists (
          select 1
          from public.appointments appointment
          where appointment.customer_id = customer.id
            and appointment.status in ('pending', 'confirmed')
            and appointment.date >= timezone('utc', now())
        )
    )
    select
      base.customer_id,
      base.last_completed_appointment_id,
      public.align_growth_booking_to_habit(
        base.last_visit_at + make_interval(days => base.recommended_interval_days),
        base.preferred_isodow,
        coalesce(owner_salon.timezone, 'America/Sao_Paulo')
      ) as target_booking_at
    from base
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
    'smart_rebook_due_customers',
    coalesce(
      count(*) filter (
        where resolved_settings.smart_rebook_is_active
          and smart_rebook_candidates.customer_id is not null
          and (smart_rebook_candidates.target_booking_at at time zone coalesce(owner_salon.timezone, 'America/Sao_Paulo'))::date
            between (timezone('utc', now()) at time zone coalesce(owner_salon.timezone, 'America/Sao_Paulo'))::date
            and (
              (timezone('utc', now()) at time zone coalesce(owner_salon.timezone, 'America/Sao_Paulo'))::date
              + resolved_settings.smart_rebook_window_days
            )
          and not exists (
            select 1
            from private.customer_growth_automation_runs automation_run
            where automation_run.automation_type = 'smart_rebook_prompt'
              and automation_run.customer_id = smart_rebook_candidates.customer_id
              and automation_run.last_completed_appointment_id = smart_rebook_candidates.last_completed_appointment_id
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
    'smart_rebooks_sent_last_30d',
    (
      select count(*)::integer
      from private.customer_growth_automation_runs automation_run
      where automation_run.salon_id = owner_salon.id
        and automation_run.automation_type = 'smart_rebook_prompt'
        and automation_run.sent_at >= timezone('utc', now()) - interval '30 days'
    ),
    'recovered_customers_last_30d',
    (
      select count(distinct automation_run.customer_id)::integer
      from private.customer_growth_automation_runs automation_run
      where automation_run.salon_id = owner_salon.id
        and automation_run.automation_type in ('winback_offer', 'smart_rebook_prompt')
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
  cross join resolved_settings
  left join smart_rebook_candidates
    on smart_rebook_candidates.customer_id = customer_activity.customer_id;

  with recent_runs as (
    select
      automation_run.id,
      automation_run.automation_type,
      automation_run.customer_id,
      coalesce(customer.name, 'Cliente do salão') as customer_name,
      automation_run.notification_id,
      automation_run.sent_at,
      coalesce((automation_run.payload ->> 'inactiveDays')::integer, 0) as inactive_days,
      coalesce((automation_run.payload ->> 'discountPercent')::integer, 0) as discount_percent,
      coalesce(automation_run.payload ->> 'serviceName', 'seu atendimento') as service_name,
      automation_run.payload ->> 'targetWeekday' as target_weekday,
      automation_run.payload ->> 'targetPeriod' as target_period,
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
      and automation_run.automation_type in ('winback_offer', 'smart_rebook_prompt')
    order by automation_run.sent_at desc
    limit 8
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', recent_runs.id,
        'automation_type', recent_runs.automation_type,
        'customer_id', recent_runs.customer_id,
        'customer_name', recent_runs.customer_name,
        'notification_id', recent_runs.notification_id,
        'sent_at', recent_runs.sent_at,
        'inactive_days', recent_runs.inactive_days,
        'discount_percent', recent_runs.discount_percent,
        'service_name', recent_runs.service_name,
        'target_weekday', recent_runs.target_weekday,
        'target_period', recent_runs.target_period,
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
  smart_rebook_active boolean := true;
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
  habit_profile record;
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
    coalesce(settings.winback_discount_percent, 10),
    coalesce(settings.smart_rebook_is_active, true)
  into
    salon_timezone,
    growth_automation_active,
    growth_inactive_days,
    growth_discount_percent,
    smart_rebook_active
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

  select *
  into habit_profile
  from public.get_customer_growth_habit(
    customer_profile.id,
    salon_timezone,
    last_visit.service_segment
  );

  if habit_profile.preferred_isodow is not null then
    recommended_booking_date := public.align_growth_booking_to_habit(
      recommended_booking_date,
      habit_profile.preferred_isodow,
      salon_timezone
    );
  end if;

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
        'incentive_percent', case when incentive_percent > 0 then incentive_percent else null end,
        'habit_weekday', habit_profile.preferred_weekday_label,
        'habit_period', habit_profile.preferred_period_label,
        'habit_confidence', habit_profile.confidence,
        'is_habit_based', case when smart_rebook_active and habit_profile.preferred_isodow is not null then true else null end
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
          'incentive_percent', null,
          'habit_weekday', habit_profile.preferred_weekday_label,
          'habit_period', habit_profile.preferred_period_label,
          'habit_confidence', habit_profile.confidence,
          'is_habit_based', case when smart_rebook_active and habit_profile.preferred_isodow is not null then true else null end
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
  smart_rebook_record record;
  queued_count integer := 0;
  smart_rebook_queued_count integer := 0;
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

        raise log 'queue_due_customer_growth_notifications failed for winback customer %: %', winback_record.customer_id, sqlerrm;
        continue;
    end;

    queued_count := queued_count + 1;
  end loop;

  for smart_rebook_record in
    with completed_visits as (
      select
        appointment.customer_id,
        appointment.salon_id,
        appointment.id as appointment_id,
        coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
        service.id as service_id,
        coalesce(service.name, 'seu atendimento') as service_name,
        service.category as service_category,
        public.detect_service_growth_segment(service.name, service.category) as service_segment,
        row_number() over (
          partition by appointment.customer_id
          order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
        ) as row_number
      from public.appointments appointment
      join public.services service
        on service.id = appointment.service_id
      where appointment.status = 'completed'
    ),
    base as (
      select
        customer.id as customer_id,
        customer.salon_id,
        completed_visits.appointment_id as last_completed_appointment_id,
        completed_visits.service_id,
        completed_visits.service_name,
        completed_visits.service_category,
        completed_visits.service_segment,
        completed_visits.last_visit_at,
        coalesce(salon.timezone, 'America/Sao_Paulo') as salon_timezone,
        coalesce(settings.smart_rebook_is_active, true) as smart_rebook_is_active,
        coalesce(settings.smart_rebook_window_days, 4) as smart_rebook_window_days,
        coalesce(nullif(btrim(settings.smart_rebook_title), ''), 'Hora do seu próximo {service_name}') as smart_rebook_title,
        coalesce(
          nullif(btrim(settings.smart_rebook_body_template), ''),
          'Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.'
        ) as smart_rebook_body_template,
        coalesce(settings.winback_inactive_days, 30) as winback_inactive_days,
        public.infer_service_revisit_interval_days(
          completed_visits.service_name,
          completed_visits.service_category
        ) as recommended_interval_days
      from public.customers customer
      join public.salons salon
        on salon.id = customer.salon_id
      join completed_visits
        on completed_visits.customer_id = customer.id
       and completed_visits.row_number = 1
      left join public.salon_growth_automation_settings settings
        on settings.salon_id = customer.salon_id
      where customer.salon_id = salon.id
        and coalesce(settings.smart_rebook_is_active, true)
        and not exists (
          select 1
          from public.appointments appointment
          where appointment.customer_id = customer.id
            and appointment.status in ('pending', 'confirmed')
            and appointment.date >= run_at
        )
    ),
    habits as (
      select
        base.*,
        habit.preferred_isodow,
        habit.preferred_weekday_label as habit_weekday,
        habit.preferred_period_label as habit_period,
        habit.confidence as habit_confidence,
        public.align_growth_booking_to_habit(
          base.last_visit_at + make_interval(days => base.recommended_interval_days),
          habit.preferred_isodow,
          base.salon_timezone
        ) as target_booking_at,
        greatest(
          0,
          (run_at at time zone base.salon_timezone)::date
          - (base.last_visit_at at time zone base.salon_timezone)::date
        )::integer as inactive_days
      from base
      join lateral public.get_customer_growth_habit(
        base.customer_id,
        base.salon_timezone,
        base.service_segment
      ) habit
        on true
    ),
    candidates as (
      select
        habits.*,
        public.iso_weekday_label(
          extract(isodow from habits.target_booking_at at time zone habits.salon_timezone)::integer
        ) as target_weekday,
        public.growth_period_label(
          extract(hour from habits.target_booking_at at time zone habits.salon_timezone)::integer
        ) as target_period,
        greatest(
          0,
          (
            (habits.target_booking_at at time zone habits.salon_timezone)::date
            - (run_at at time zone habits.salon_timezone)::date
          )
        )::integer as days_until_due,
        combo_service.service_name as combo_service_name
      from habits
      left join lateral (
        select
          coalesce(service.name, 'serviço complementar') as service_name
        from public.services service
        where service.salon_id = habits.salon_id
          and service.id <> habits.service_id
          and public.detect_service_growth_segment(service.name, service.category) = public.combo_target_growth_segment(habits.service_segment)
        order by service.sort_order asc, service.price asc, service.name asc
        limit 1
      ) combo_service
        on true
    )
    select *
    from candidates
    where inactive_days < winback_inactive_days
      and target_booking_at >= run_at
      and target_booking_at < run_at + make_interval(days => smart_rebook_window_days + 1)
      and not exists (
        select 1
        from private.customer_growth_automation_runs automation_run
        where automation_run.automation_type = 'smart_rebook_prompt'
          and automation_run.customer_id = candidates.customer_id
          and automation_run.last_completed_appointment_id = candidates.last_completed_appointment_id
      )
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
      'smart_rebook_prompt',
      smart_rebook_record.salon_id,
      smart_rebook_record.customer_id,
      null,
      smart_rebook_record.last_completed_appointment_id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'serviceId', smart_rebook_record.service_id,
          'serviceName', smart_rebook_record.service_name,
          'recommendedIntervalDays', smart_rebook_record.recommended_interval_days,
          'targetWeekday', smart_rebook_record.target_weekday,
          'targetPeriod', smart_rebook_record.target_period,
          'daysUntilDue', smart_rebook_record.days_until_due,
          'habitWeekday', smart_rebook_record.habit_weekday,
          'habitPeriod', smart_rebook_record.habit_period,
          'habitConfidence', smart_rebook_record.habit_confidence,
          'comboServiceName', smart_rebook_record.combo_service_name,
          'lastVisitAt', smart_rebook_record.last_visit_at,
          'targetBookingAt', smart_rebook_record.target_booking_at
        )
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
        smart_rebook_record.salon_id,
        smart_rebook_record.customer_id,
        'single_customer',
        'smart_rebook_prompt',
        public.render_smart_rebook_template(
          smart_rebook_record.smart_rebook_title,
          smart_rebook_record.service_name,
          smart_rebook_record.habit_weekday,
          smart_rebook_record.target_weekday,
          smart_rebook_record.target_period,
          smart_rebook_record.days_until_due,
          smart_rebook_record.combo_service_name
        ),
        public.render_smart_rebook_template(
          smart_rebook_record.smart_rebook_body_template,
          smart_rebook_record.service_name,
          smart_rebook_record.habit_weekday,
          smart_rebook_record.target_weekday,
          smart_rebook_record.target_period,
          smart_rebook_record.days_until_due,
          smart_rebook_record.combo_service_name
        ),
        jsonb_strip_nulls(
          jsonb_build_object(
            'type', 'smart_rebook_prompt',
            'serviceId', smart_rebook_record.service_id,
            'serviceName', smart_rebook_record.service_name,
            'recommendedIntervalDays', smart_rebook_record.recommended_interval_days,
            'targetWeekday', smart_rebook_record.target_weekday,
            'targetPeriod', smart_rebook_record.target_period,
            'daysUntilDue', smart_rebook_record.days_until_due,
            'habitWeekday', smart_rebook_record.habit_weekday,
            'habitPeriod', smart_rebook_record.habit_period,
            'habitConfidence', smart_rebook_record.habit_confidence,
            'comboServiceName', smart_rebook_record.combo_service_name,
            'lastVisitAt', smart_rebook_record.last_visit_at,
            'targetBookingAt', smart_rebook_record.target_booking_at
          )
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

        raise log 'queue_due_customer_growth_notifications failed for smart rebook customer %: %', smart_rebook_record.customer_id, sqlerrm;
        continue;
    end;

    smart_rebook_queued_count := smart_rebook_queued_count + 1;
  end loop;

  return jsonb_build_object(
    'processedAt', run_at,
    'winbackQueued', queued_count,
    'smartRebookQueued', smart_rebook_queued_count
  );
end;
$$;

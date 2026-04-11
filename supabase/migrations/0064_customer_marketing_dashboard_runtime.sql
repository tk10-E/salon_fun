alter table public.customers
add column if not exists birth_date date;

alter table public.customers
drop constraint if exists customers_birth_date_check;

alter table public.customers
add constraint customers_birth_date_check
check (
  birth_date is null
  or birth_date between date '1900-01-01' and date '2100-12-31'
);

create index if not exists customers_salon_birth_date_idx
on public.customers (salon_id, birth_date)
where birth_date is not null;

drop function if exists public.update_owner_customer_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date
);

create or replace function public.update_owner_customer_profile(
  customer_uuid uuid,
  phone_input text default null,
  preferences_input text default null,
  allergies_input text default null,
  beauty_products_input text default null,
  crm_label_input text default null,
  internal_notes_input text default null,
  beauty_goals_input text default null,
  contraindications_input text default null,
  technical_notes_input text default null,
  consent_status_input text default null,
  last_assessment_at_input date default null,
  birth_date_input date default null
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  existing_customer public.customers;
  updated_customer public.customers;
  normalized_consent_status text := lower(btrim(coalesce(consent_status_input, '')));
  resolved_consent_status text;
  resolved_consent_signed_at timestamptz;
  resolved_consent_version text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  if normalized_consent_status not in ('', 'pending', 'signed', 'not_required') then
    raise exception 'invalid_consent_status';
  end if;

  resolved_consent_status := case
    when normalized_consent_status = '' then 'not_required'
    else normalized_consent_status
  end;

  select *
  into existing_customer
  from public.customers
  where id = customer_uuid
    and salon_id = owner_salon_id
  for update;

  if existing_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  resolved_consent_signed_at := case
    when resolved_consent_status = 'signed'
      then coalesce(existing_customer.consent_signed_at, timezone('utc', now()))
    else null
  end;

  resolved_consent_version := case
    when resolved_consent_status = 'signed'
      then coalesce(nullif(btrim(existing_customer.consent_version), ''), 'owner-panel-manual-v1')
    else null
  end;

  update public.customers
  set
    phone = nullif(btrim(phone_input), ''),
    preferences = nullif(btrim(preferences_input), ''),
    allergies = nullif(btrim(allergies_input), ''),
    beauty_products = nullif(btrim(beauty_products_input), ''),
    crm_label = nullif(left(btrim(crm_label_input), 40), ''),
    internal_notes = nullif(left(btrim(internal_notes_input), 2000), ''),
    beauty_goals = nullif(left(btrim(beauty_goals_input), 800), ''),
    contraindications = nullif(left(btrim(contraindications_input), 800), ''),
    technical_notes = nullif(left(btrim(technical_notes_input), 1200), ''),
    consent_status = resolved_consent_status,
    consent_signed_at = resolved_consent_signed_at,
    consent_version = resolved_consent_version,
    last_assessment_at = last_assessment_at_input,
    birth_date = birth_date_input
  where id = existing_customer.id
  returning *
  into updated_customer;

  return updated_customer;
end;
$$;

grant execute on function public.update_owner_customer_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  date
)
to authenticated;

create or replace function public.get_salon_marketing_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner_salon_id uuid;
  owner_timezone text := 'America/Sao_Paulo';
  current_local_date date := (timezone('utc', now()) at time zone owner_timezone)::date;
  configured_program public.salon_loyalty_programs;
  inactive_threshold_days integer := 30;
  loyalty_tiers jsonb := '[]'::jsonb;
  birthday_customers jsonb := '[]'::jsonb;
  inactive_customers jsonb := '[]'::jsonb;
  birthdays_this_month integer := 0;
  customers_with_birth_date integer := 0;
  inactive_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select coalesce(salon.timezone, 'America/Sao_Paulo')
  into owner_timezone
  from public.salons salon
  where salon.id = owner_salon_id;

  current_local_date := (timezone('utc', now()) at time zone owner_timezone)::date;

  select *
  into configured_program
  from public.salon_loyalty_programs
  where salon_id = owner_salon_id
  order by created_at desc
  limit 1;

  select coalesce(settings.winback_inactive_days, 30)
  into inactive_threshold_days
  from public.salons salon
  left join public.salon_growth_automation_settings settings
    on settings.salon_id = salon.id
  where salon.id = owner_salon_id
  limit 1;

  if configured_program.id is not null then
    with balances as (
      select
        customer.id as customer_id,
        coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
        coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance,
        coalesce(sum(loyalty.completed_visit_delta), 0)::integer as completed_visits
      from public.customers customer
      left join public.customer_loyalty_transactions loyalty
        on loyalty.customer_id = customer.id
      where customer.salon_id = owner_salon_id
      group by customer.id
    ),
    resolved_tiers as (
      select
        public.resolve_loyalty_tier_snapshot(
          configured_program.tier_one_name,
          configured_program.tier_one_min_visits,
          configured_program.tier_one_discount_percent,
          configured_program.tier_two_name,
          configured_program.tier_two_min_visits,
          configured_program.tier_two_discount_percent,
          configured_program.vip_tier_name,
          configured_program.vip_min_visits,
          configured_program.vip_discount_percent,
          balances.completed_visits
        ) as tier_snapshot
      from balances
      where balances.points_balance > 0
         or balances.completed_visits > 0
         or balances.cashback_balance > 0
    ),
    summarized_tiers as (
      select
        tier_snapshot ->> 'label' as label,
        coalesce((tier_snapshot ->> 'min_visits')::integer, 0) as min_visits,
        coalesce((tier_snapshot ->> 'is_vip')::boolean, false) as is_vip,
        count(*)::integer as customer_count
      from resolved_tiers
      where tier_snapshot is not null
      group by 1, 2, 3
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'label', summarized_tiers.label,
          'min_visits', summarized_tiers.min_visits,
          'is_vip', summarized_tiers.is_vip,
          'customer_count', summarized_tiers.customer_count
        )
        order by summarized_tiers.min_visits, summarized_tiers.label
      ),
      '[]'::jsonb
    )
    into loyalty_tiers
    from summarized_tiers;
  end if;

  select count(*)::integer
  into customers_with_birth_date
  from public.customers customer
  where customer.salon_id = owner_salon_id
    and customer.birth_date is not null;

  select count(*)::integer
  into birthdays_this_month
  from public.customers customer
  where customer.salon_id = owner_salon_id
    and customer.birth_date is not null
    and extract(month from customer.birth_date) = extract(month from current_local_date);

  with monthly_birthdays as (
    select
      customer.id as customer_id,
      customer.name,
      customer.phone,
      customer.birth_date,
      extract(day from customer.birth_date)::integer as birth_day
    from public.customers customer
    where customer.salon_id = owner_salon_id
      and customer.birth_date is not null
      and extract(month from customer.birth_date) = extract(month from current_local_date)
    order by extract(day from customer.birth_date), customer.name
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'customer_id', monthly_birthdays.customer_id,
        'name', monthly_birthdays.name,
        'phone', monthly_birthdays.phone,
        'birth_date', monthly_birthdays.birth_date,
        'birth_day', monthly_birthdays.birth_day
      )
      order by monthly_birthdays.birth_day, monthly_birthdays.name
    ),
    '[]'::jsonb
  )
  into birthday_customers
  from monthly_birthdays;

  with completed_visits as (
    select
      appointment.customer_id,
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
      service.name as last_service_name,
      row_number() over (
        partition by appointment.customer_id
        order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
      ) as row_number
    from public.appointments appointment
    left join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon_id
      and appointment.status = 'completed'
  ),
  customer_activity as (
    select
      customer.id as customer_id,
      customer.name,
      customer.phone,
      completed_visits.last_visit_at,
      completed_visits.last_service_name,
      greatest(
        0,
        current_local_date
        - (completed_visits.last_visit_at at time zone owner_timezone)::date
      )::integer as inactive_days
    from public.customers customer
    join completed_visits
      on completed_visits.customer_id = customer.id
     and completed_visits.row_number = 1
    where customer.salon_id = owner_salon_id
      and not exists (
        select 1
        from public.appointments appointment
        where appointment.salon_id = owner_salon_id
          and appointment.customer_id = customer.id
          and appointment.status in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )
  )
  select count(*)::integer
  into inactive_total
  from customer_activity
  where customer_activity.inactive_days >= inactive_threshold_days;

  with completed_visits as (
    select
      appointment.customer_id,
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
      service.name as last_service_name,
      row_number() over (
        partition by appointment.customer_id
        order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
      ) as row_number
    from public.appointments appointment
    left join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon_id
      and appointment.status = 'completed'
  ),
  customer_activity as (
    select
      customer.id as customer_id,
      customer.name,
      customer.phone,
      completed_visits.last_visit_at,
      completed_visits.last_service_name,
      greatest(
        0,
        current_local_date
        - (completed_visits.last_visit_at at time zone owner_timezone)::date
      )::integer as inactive_days
    from public.customers customer
    join completed_visits
      on completed_visits.customer_id = customer.id
     and completed_visits.row_number = 1
    where customer.salon_id = owner_salon_id
      and not exists (
        select 1
        from public.appointments appointment
        where appointment.salon_id = owner_salon_id
          and appointment.customer_id = customer.id
          and appointment.status in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )
  ),
  inactive_base as (
    select
      customer_activity.customer_id,
      customer_activity.name,
      customer_activity.phone,
      customer_activity.last_visit_at,
      customer_activity.last_service_name,
      customer_activity.inactive_days
    from customer_activity
    where customer_activity.inactive_days >= inactive_threshold_days
    order by customer_activity.inactive_days desc, customer_activity.name
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'customer_id', inactive_base.customer_id,
        'name', inactive_base.name,
        'phone', inactive_base.phone,
        'last_visit_at', inactive_base.last_visit_at,
        'last_service_name', inactive_base.last_service_name,
        'inactive_days', inactive_base.inactive_days
      )
      order by inactive_base.inactive_days desc, inactive_base.name
    ),
    '[]'::jsonb
  )
  into inactive_customers
  from inactive_base;

  return jsonb_build_object(
    'loyalty_tiers', loyalty_tiers,
    'birthday_customers', birthday_customers,
    'birthdays_this_month', birthdays_this_month,
    'customers_with_birth_date', customers_with_birth_date,
    'inactive_customers', inactive_customers,
    'inactive_threshold_days', inactive_threshold_days,
    'inactive_total', inactive_total
  );
end;
$$;

grant execute on function public.get_salon_marketing_dashboard()
to authenticated;

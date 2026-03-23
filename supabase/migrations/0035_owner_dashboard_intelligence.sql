create or replace function public.get_owner_dashboard_intelligence(
  lapsed_limit_input integer default 4,
  top_customer_limit_input integer default 5,
  top_service_limit_input integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner_salon public.salons;
  owner_timezone text := 'America/Sao_Paulo';
  safe_lapsed_limit integer := least(greatest(coalesce(lapsed_limit_input, 4), 1), 10);
  safe_top_customer_limit integer := least(greatest(coalesce(top_customer_limit_input, 5), 1), 10);
  safe_top_service_limit integer := least(greatest(coalesce(top_service_limit_input, 5), 1), 10);
  payload jsonb := jsonb_build_object(
    'overview',
    jsonb_build_object(
      'tracked_lapsed_customers', 0,
      'tracked_due_now_customers', 0,
      'tracked_top_customers', 0,
      'tracked_top_services', 0
    ),
    'lapsed_customers', '[]'::jsonb,
    'top_customers', '[]'::jsonb,
    'top_services', '[]'::jsonb
  );
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where id = public.current_owner_salon_id();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  owner_timezone := coalesce(owner_salon.timezone, owner_timezone);

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
      coalesce(appointment.completed_at, appointment.ends_at, appointment.date) as last_visit_at,
      coalesce(service.name, 'seu atendimento') as service_name,
      service.category as service_category,
      row_number() over (
        partition by appointment.customer_id
        order by coalesce(appointment.completed_at, appointment.ends_at, appointment.date) desc
      ) as row_number
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
      and appointment.status::text = 'completed'
  ),
  customer_stats as (
    select
      customer.id,
      customer.name,
      count(*) filter (where appointment.status::text = 'completed')::integer as completed_visits,
      count(*) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      )::integer as upcoming_appointments,
      min(appointment.date) filter (
        where appointment.status::text in ('pending', 'confirmed')
          and appointment.date >= timezone('utc', now())
      ) as next_appointment_at,
      max(coalesce(appointment.completed_at, appointment.ends_at, appointment.date)) filter (
        where appointment.status::text = 'completed'
      ) as last_visit_at,
      coalesce(sum(service.price) filter (where appointment.status::text = 'completed'), 0)::numeric(10, 2) as total_spent
    from public.customers customer
    left join public.appointments appointment
      on appointment.customer_id = customer.id
     and appointment.salon_id = owner_salon.id
    left join public.services service
      on service.id = appointment.service_id
    where customer.salon_id = owner_salon.id
    group by customer.id, customer.name
  ),
  lapsed_base as (
    select
      stats.id,
      stats.name,
      stats.total_spent,
      stats.completed_visits,
      latest_visit.last_visit_at,
      latest_visit.service_name as last_service_name,
      latest_visit.service_category as last_service_category,
      greatest(
        0,
        (timezone('utc', now()) at time zone owner_timezone)::date
        - (latest_visit.last_visit_at at time zone owner_timezone)::date
      )::integer as inactive_days,
      case
        when greatest(
          0,
          (timezone('utc', now()) at time zone owner_timezone)::date
          - (latest_visit.last_visit_at at time zone owner_timezone)::date
        )::integer >= resolved_settings.winback_inactive_days then 'due_now'
        else 'at_risk'
      end as status
    from customer_stats stats
    join completed_visits latest_visit
      on latest_visit.customer_id = stats.id
     and latest_visit.row_number = 1
    join resolved_settings
      on true
    where stats.upcoming_appointments = 0
      and greatest(
        0,
        (timezone('utc', now()) at time zone owner_timezone)::date
        - (latest_visit.last_visit_at at time zone owner_timezone)::date
      )::integer >= greatest(14, resolved_settings.winback_inactive_days - 7)
  ),
  lapsed_ranked as (
    select *
    from lapsed_base
    order by
      case when status = 'due_now' then 0 else 1 end,
      inactive_days desc,
      total_spent desc,
      name asc
    limit safe_lapsed_limit
  ),
  top_customers_ranked as (
    select
      stats.id,
      stats.name,
      stats.total_spent,
      stats.completed_visits,
      stats.last_visit_at,
      stats.next_appointment_at,
      stats.upcoming_appointments
    from customer_stats stats
    where stats.completed_visits > 0
    order by
      stats.total_spent desc,
      stats.completed_visits desc,
      stats.last_visit_at desc nulls last,
      stats.name asc
    limit safe_top_customer_limit
  ),
  top_services_ranked as (
    select
      service.id,
      service.name,
      service.category,
      count(*)::integer as completed_appointments,
      count(distinct appointment.customer_id)::integer as unique_customers,
      coalesce(sum(service.price), 0)::numeric(10, 2) as total_revenue,
      max(coalesce(appointment.completed_at, appointment.ends_at, appointment.date)) as last_booked_at
    from public.appointments appointment
    join public.services service
      on service.id = appointment.service_id
    where appointment.salon_id = owner_salon.id
      and appointment.status::text = 'completed'
    group by service.id, service.name, service.category
    order by
      completed_appointments desc,
      total_revenue desc,
      last_booked_at desc nulls last,
      service.name asc
    limit safe_top_service_limit
  )
  select jsonb_build_object(
    'overview',
    jsonb_build_object(
      'tracked_lapsed_customers', coalesce((select count(*) from lapsed_base), 0),
      'tracked_due_now_customers',
      coalesce((select count(*) from lapsed_base where status = 'due_now'), 0),
      'tracked_top_customers', coalesce((select count(*) from top_customers_ranked), 0),
      'tracked_top_services', coalesce((select count(*) from top_services_ranked), 0)
    ),
    'lapsed_customers',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'name', item.name,
            'inactive_days', item.inactive_days,
            'last_visit_at', item.last_visit_at,
            'last_service_name', item.last_service_name,
            'last_service_category', item.last_service_category,
            'total_spent', item.total_spent,
            'completed_visits', item.completed_visits,
            'status', item.status
          )
          order by
            case when item.status = 'due_now' then 0 else 1 end,
            item.inactive_days desc,
            item.total_spent desc,
            item.name asc
        )
        from lapsed_ranked item
      ),
      '[]'::jsonb
    ),
    'top_customers',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'name', item.name,
            'total_spent', item.total_spent,
            'completed_visits', item.completed_visits,
            'last_visit_at', item.last_visit_at,
            'next_appointment_at', item.next_appointment_at,
            'upcoming_appointments', item.upcoming_appointments
          )
          order by
            item.total_spent desc,
            item.completed_visits desc,
            item.last_visit_at desc nulls last,
            item.name asc
        )
        from top_customers_ranked item
      ),
      '[]'::jsonb
    ),
    'top_services',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'name', item.name,
            'category', item.category,
            'completed_appointments', item.completed_appointments,
            'unique_customers', item.unique_customers,
            'total_revenue', item.total_revenue,
            'last_booked_at', item.last_booked_at
          )
          order by
            item.completed_appointments desc,
            item.total_revenue desc,
            item.last_booked_at desc nulls last,
            item.name asc
        )
        from top_services_ranked item
      ),
      '[]'::jsonb
    )
  )
  into payload;

  return payload;
end;
$$;

revoke all on function public.get_owner_dashboard_intelligence(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_owner_dashboard_intelligence(integer, integer, integer) to authenticated;

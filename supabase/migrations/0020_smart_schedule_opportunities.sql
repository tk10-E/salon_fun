create or replace function public.get_smart_schedule_opportunities(target_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_salon public.salons;
  resolved_target_day date;
  suggestions jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into active_salon
  from public.salons
  where id = coalesce(public.current_owner_salon_id(), public.current_customer_salon_id())
  limit 1;

  if active_salon.id is null then
    raise exception 'salon_not_found';
  end if;

  resolved_target_day := coalesce(target_day, timezone(active_salon.timezone, now())::date);

  with staff_windows as (
    select
      sm.id as staff_member_id,
      sm.name as staff_member_name,
      gssc.opens_at_utc as window_start,
      gssc.closes_at_utc as window_end
    from public.staff_members sm
    join lateral public.get_staff_schedule_context(sm.id, resolved_target_day) gssc on true
    where sm.salon_id = active_salon.id
      and sm.is_active
      and coalesce(gssc.is_open, false)
      and gssc.opens_at_utc is not null
      and gssc.closes_at_utc is not null
      and gssc.opens_at_utc < gssc.closes_at_utc
  ),
  raw_busy as (
    select
      sw.staff_member_id,
      greatest(a.date, sw.window_start) as starts_at,
      least(a.ends_at, sw.window_end) as ends_at
    from staff_windows sw
    join public.appointments a
      on a.staff_member_id = sw.staff_member_id
     and a.status in ('pending', 'confirmed')
     and tstzrange(a.date, a.ends_at, '[)') && tstzrange(sw.window_start, sw.window_end, '[)')

    union all

    select
      sw.staff_member_id,
      greatest(sb.starts_at, sw.window_start) as starts_at,
      least(sb.ends_at, sw.window_end) as ends_at
    from staff_windows sw
    join public.staff_blocks sb
      on sb.staff_member_id = sw.staff_member_id
     and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(sw.window_start, sw.window_end, '[)')
  ),
  clipped_busy as (
    select
      staff_member_id,
      starts_at,
      ends_at
    from raw_busy
    where ends_at > starts_at
  ),
  ordered_busy as (
    select
      staff_member_id,
      starts_at,
      ends_at,
      max(ends_at) over (
        partition by staff_member_id
        order by starts_at, ends_at
        rows between unbounded preceding and current row
      ) as running_end
    from clipped_busy
  ),
  busy_breaks as (
    select
      staff_member_id,
      starts_at,
      ends_at,
      case
        when lag(running_end) over (partition by staff_member_id order by starts_at, ends_at) is null then 0
        when starts_at > lag(running_end) over (partition by staff_member_id order by starts_at, ends_at) then 1
        else 0
      end as starts_new_group
    from ordered_busy
  ),
  merged_busy as (
    select
      staff_member_id,
      min(starts_at) as starts_at,
      max(ends_at) as ends_at
    from (
      select
        staff_member_id,
        starts_at,
        ends_at,
        sum(starts_new_group) over (
          partition by staff_member_id
          order by starts_at, ends_at
          rows between unbounded preceding and current row
        ) as group_number
      from busy_breaks
    ) grouped
    group by staff_member_id, group_number
  ),
  first_busy as (
    select distinct on (staff_member_id)
      staff_member_id,
      starts_at
    from merged_busy
    order by staff_member_id, starts_at
  ),
  last_busy as (
    select distinct on (staff_member_id)
      staff_member_id,
      ends_at
    from merged_busy
    order by staff_member_id, ends_at desc
  ),
  between_gaps as (
    select
      mb.staff_member_id,
      mb.ends_at as gap_start,
      lead(mb.starts_at) over (
        partition by mb.staff_member_id
        order by mb.starts_at
      ) as gap_end
    from merged_busy mb
  ),
  gaps as (
    select
      sw.staff_member_id,
      sw.staff_member_name,
      'open_day'::text as gap_kind,
      sw.window_start as gap_start,
      sw.window_end as gap_end
    from staff_windows sw
    where not exists (
      select 1
      from merged_busy mb
      where mb.staff_member_id = sw.staff_member_id
    )

    union all

    select
      sw.staff_member_id,
      sw.staff_member_name,
      'before_first'::text as gap_kind,
      sw.window_start as gap_start,
      fb.starts_at as gap_end
    from staff_windows sw
    join first_busy fb
      on fb.staff_member_id = sw.staff_member_id
    where sw.window_start < fb.starts_at

    union all

    select
      sw.staff_member_id,
      sw.staff_member_name,
      'between_appointments'::text as gap_kind,
      bg.gap_start,
      bg.gap_end
    from between_gaps bg
    join staff_windows sw
      on sw.staff_member_id = bg.staff_member_id
    where bg.gap_end is not null
      and bg.gap_start < bg.gap_end

    union all

    select
      sw.staff_member_id,
      sw.staff_member_name,
      'after_last'::text as gap_kind,
      lb.ends_at as gap_start,
      sw.window_end as gap_end
    from staff_windows sw
    join last_busy lb
      on lb.staff_member_id = sw.staff_member_id
    where lb.ends_at < sw.window_end
  ),
  valid_gaps as (
    select
      g.staff_member_id,
      g.staff_member_name,
      g.gap_kind,
      g.gap_start,
      g.gap_end,
      floor(extract(epoch from (g.gap_end - g.gap_start)) / 60)::int as gap_minutes
    from gaps g
    where g.gap_end > g.gap_start
  ),
  candidate_slots as (
    select
      g.staff_member_id,
      g.staff_member_name,
      g.gap_kind,
      g.gap_start,
      g.gap_end,
      g.gap_minutes,
      s.id as service_id,
      s.name as service_name,
      s.category as service_category,
      s.duration as service_duration,
      s.price as service_price,
      av.start_at as suggested_start,
      av.ends_at as suggested_end,
      row_number() over (
        partition by g.staff_member_id, g.gap_start, g.gap_end
        order by s.duration desc, av.start_at desc, s.name asc
      ) as suggestion_rank
    from valid_gaps g
    join public.staff_service_assignments ssa
      on ssa.staff_member_id = g.staff_member_id
    join public.services s
      on s.id = ssa.service_id
     and s.salon_id = active_salon.id
     and s.duration <= g.gap_minutes
    join lateral public.get_available_staff_slots_for_service(s.id, resolved_target_day) av
      on av.staff_member_id = g.staff_member_id
     and av.start_at >= g.gap_start
     and av.ends_at <= g.gap_end
  ),
  service_ranked as (
    select
      ranked.staff_member_id,
      ranked.gap_start,
      ranked.gap_end,
      ranked.service_id,
      ranked.service_name,
      ranked.service_category,
      ranked.service_duration,
      ranked.service_price,
      row_number() over (
        partition by ranked.staff_member_id, ranked.gap_start, ranked.gap_end
        order by ranked.service_duration desc, ranked.service_name asc
      ) as service_rank
    from (
      select distinct on (staff_member_id, gap_start, gap_end, service_id)
        staff_member_id,
        gap_start,
        gap_end,
        service_id,
        service_name,
        service_category,
        service_duration,
        service_price
      from candidate_slots
      order by staff_member_id, gap_start, gap_end, service_id, suggested_start desc
    ) ranked
  ),
  gap_service_summary as (
    select
      staff_member_id,
      gap_start,
      gap_end,
      count(*)::int as compatible_service_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', service_id,
            'name', service_name,
            'category', service_category,
            'duration', service_duration,
            'price', service_price
          )
          order by service_duration desc, service_name
        ) filter (where service_rank <= 3),
        '[]'::jsonb
      ) as compatible_services
    from service_ranked
    group by staff_member_id, gap_start, gap_end
  ),
  best_suggestions as (
    select
      cs.staff_member_id,
      cs.staff_member_name,
      cs.gap_kind,
      cs.gap_start,
      cs.gap_end,
      cs.gap_minutes,
      cs.suggested_start,
      cs.suggested_end,
      cs.service_id,
      cs.service_name,
      cs.service_category,
      cs.service_duration,
      cs.service_price,
      gss.compatible_service_count,
      gss.compatible_services
    from candidate_slots cs
    join gap_service_summary gss
      on gss.staff_member_id = cs.staff_member_id
     and gss.gap_start = cs.gap_start
     and gss.gap_end = cs.gap_end
    where cs.suggestion_rank = 1
  ),
  ordered_suggestions as (
    select
      bs.*,
      case bs.gap_kind
        when 'between_appointments' then format(
          'Cabe mais 1 cliente às %s entre atendimentos.',
          to_char(bs.suggested_start at time zone active_salon.timezone, 'HH24:MI')
        )
        when 'before_first' then format(
          'A agenda pode começar com encaixe às %s.',
          to_char(bs.suggested_start at time zone active_salon.timezone, 'HH24:MI')
        )
        when 'after_last' then format(
          'Ainda cabe encaixe às %s depois do último atendimento.',
          to_char(bs.suggested_start at time zone active_salon.timezone, 'HH24:MI')
        )
        else format(
          'Há espaço livre às %s na agenda de hoje.',
          to_char(bs.suggested_start at time zone active_salon.timezone, 'HH24:MI')
        )
      end as headline,
      case
        when bs.compatible_service_count = 1 then format(
          '%s atende %s com duração de %s min nesse encaixe.',
          bs.staff_member_name,
          bs.service_name,
          bs.service_duration
        )
        else format(
          '%s serviços cabem nessa janela com %s.',
          bs.compatible_service_count,
          bs.staff_member_name
        )
      end as detail,
      row_number() over (
        order by
          case bs.gap_kind
            when 'between_appointments' then 0
            when 'before_first' then 1
            when 'after_last' then 2
            else 3
          end,
          bs.suggested_start,
          bs.staff_member_name
      ) as overall_rank
    from best_suggestions bs
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'staff_member_id', staff_member_id,
        'staff_member_name', staff_member_name,
        'gap_kind', gap_kind,
        'gap_start', gap_start,
        'gap_end', gap_end,
        'gap_minutes', gap_minutes,
        'suggested_start', suggested_start,
        'suggested_end', suggested_end,
        'headline', headline,
        'detail', detail,
        'compatible_service_count', compatible_service_count,
        'compatible_services', compatible_services,
        'suggested_service', jsonb_build_object(
          'id', service_id,
          'name', service_name,
          'category', service_category,
          'duration', service_duration,
          'price', service_price
        )
      )
      order by overall_rank
    ) filter (where overall_rank <= 8),
    '[]'::jsonb
  )
  into suggestions
  from ordered_suggestions;

  return jsonb_build_object(
    'target_day', resolved_target_day,
    'timezone', active_salon.timezone,
    'slot_step_minutes', active_salon.slot_step_minutes,
    'suggestions', suggestions
  );
end;
$$;

grant execute on function public.get_smart_schedule_opportunities(date) to authenticated;

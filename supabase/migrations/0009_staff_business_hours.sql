create table if not exists public.staff_business_hours (
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (staff_member_id, weekday),
  check (
    (not is_open and opens_at is null and closes_at is null)
    or (
      is_open
      and opens_at is not null
      and closes_at is not null
      and opens_at < closes_at
    )
  )
);

create index if not exists staff_business_hours_staff_member_id_idx
on public.staff_business_hours (staff_member_id, weekday);

create or replace function public.touch_staff_business_hours_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists staff_business_hours_touch_updated_at on public.staff_business_hours;

create trigger staff_business_hours_touch_updated_at
before update on public.staff_business_hours
for each row
execute function public.touch_staff_business_hours_updated_at();

create or replace function public.seed_staff_business_hours(target_staff_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_salon_id uuid;
begin
  select salon_id
  into target_salon_id
  from public.staff_members
  where id = target_staff_member_id;

  if target_salon_id is null then
    return;
  end if;

  insert into public.staff_business_hours (staff_member_id, weekday, is_open, opens_at, closes_at)
  select
    target_staff_member_id,
    sbh.weekday,
    sbh.is_open,
    sbh.opens_at,
    sbh.closes_at
  from public.salon_business_hours sbh
  where sbh.salon_id = target_salon_id
  on conflict (staff_member_id, weekday) do nothing;
end;
$$;

create or replace function public.seed_staff_business_hours_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_staff_business_hours(new.id);
  return new;
end;
$$;

drop trigger if exists staff_members_seed_business_hours on public.staff_members;

create trigger staff_members_seed_business_hours
after insert on public.staff_members
for each row
execute function public.seed_staff_business_hours_from_trigger();

select public.seed_staff_business_hours(id)
from public.staff_members;

alter table public.staff_business_hours enable row level security;

drop policy if exists "owners_manage_staff_business_hours" on public.staff_business_hours;
drop policy if exists "customers_read_staff_business_hours" on public.staff_business_hours;

create policy "owners_manage_staff_business_hours"
on public.staff_business_hours
for all
to authenticated
using (
  exists (
    select 1
    from public.staff_members sm
    where sm.id = staff_member_id
      and public.is_owner_of_salon(sm.salon_id)
  )
)
with check (
  exists (
    select 1
    from public.staff_members sm
    where sm.id = staff_member_id
      and public.is_owner_of_salon(sm.salon_id)
  )
);

create policy "customers_read_staff_business_hours"
on public.staff_business_hours
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_members sm
    where sm.id = staff_member_id
      and public.is_customer_of_salon(sm.salon_id)
  )
);

create or replace function public.get_staff_schedule_context(target_staff_member_id uuid, target_day date)
returns table (
  staff_member_id uuid,
  salon_id uuid,
  timezone text,
  is_open boolean,
  opens_at time,
  closes_at time,
  opens_at_utc timestamptz,
  closes_at_utc timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sm.id,
    sm.salon_id,
    s.timezone,
    coalesce(sbh.is_open, false) as is_open,
    sbh.opens_at,
    sbh.closes_at,
    case
      when coalesce(sbh.is_open, false) and sbh.opens_at is not null
        then ((target_day::timestamp + sbh.opens_at) at time zone s.timezone)
      else null
    end as opens_at_utc,
    case
      when coalesce(sbh.is_open, false) and sbh.closes_at is not null
        then ((target_day::timestamp + sbh.closes_at) at time zone s.timezone)
      else null
    end as closes_at_utc
  from public.staff_members sm
  join public.salons s
    on s.id = sm.salon_id
  left join public.staff_business_hours sbh
    on sbh.staff_member_id = sm.id
   and sbh.weekday = extract(dow from target_day)::int
  where sm.id = target_staff_member_id;
$$;

create or replace function public.get_available_staff_slots_for_service(service_uuid uuid, target_day date)
returns table (
  start_at timestamptz,
  ends_at timestamptz,
  staff_member_id uuid,
  staff_member_name text
)
language sql
security definer
set search_path = public
as $$
  with service_context as (
    select s.id as service_id, s.salon_id, s.duration
    from public.services s
    where s.id = service_uuid
  ),
  schedule as (
    select sc.service_id, sc.salon_id, sc.duration, gsc.timezone, gsc.slot_step_minutes, gsc.is_open, gsc.opens_at,
           gsc.closes_at, gsc.opens_at_utc, gsc.closes_at_utc
    from service_context sc
    join lateral public.get_salon_schedule_context(sc.salon_id, target_day) gsc on true
  ),
  eligible_staff as (
    select
      sm.id,
      sm.name,
      gssc.is_open as staff_is_open,
      gssc.opens_at as staff_opens_at,
      gssc.closes_at as staff_closes_at,
      gssc.opens_at_utc as staff_opens_at_utc,
      gssc.closes_at_utc as staff_closes_at_utc
    from service_context sc
    join public.staff_service_assignments ssa
      on ssa.service_id = sc.service_id
    join public.staff_members sm
      on sm.id = ssa.staff_member_id
    join lateral public.get_staff_schedule_context(sm.id, target_day) gssc on true
    where sm.is_active
  )
  select
    slot.start_at,
    slot.start_at + make_interval(mins => schedule.duration) as ends_at,
    eligible_staff.id,
    eligible_staff.name
  from schedule
  join eligible_staff
    on eligible_staff.staff_is_open
  cross join lateral (
    select
      greatest(schedule.opens_at_utc, eligible_staff.staff_opens_at_utc) as effective_opens_at_utc,
      least(schedule.closes_at_utc, eligible_staff.staff_closes_at_utc) as effective_closes_at_utc
  ) staff_window
  cross join lateral generate_series(
    staff_window.effective_opens_at_utc,
    staff_window.effective_closes_at_utc - make_interval(mins => schedule.duration),
    make_interval(mins => schedule.slot_step_minutes)
  ) as slot(start_at)
  where schedule.is_open
    and schedule.opens_at_utc is not null
    and schedule.closes_at_utc is not null
    and eligible_staff.staff_opens_at_utc is not null
    and eligible_staff.staff_closes_at_utc is not null
    and staff_window.effective_opens_at_utc < staff_window.effective_closes_at_utc
    and slot.start_at > timezone('utc', now())
    and not exists (
      select 1
      from public.appointments a
      where a.staff_member_id = eligible_staff.id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.date, a.ends_at, '[)') && tstzrange(
          slot.start_at,
          slot.start_at + make_interval(mins => schedule.duration),
          '[)'
        )
    )
    and not exists (
      select 1
      from public.staff_blocks sb
      where sb.staff_member_id = eligible_staff.id
        and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(
          slot.start_at,
          slot.start_at + make_interval(mins => schedule.duration),
          '[)'
        )
    )
  order by slot.start_at, eligible_staff.name;
$$;

drop function if exists public.get_day_availability(uuid, date);

create or replace function public.get_day_availability(service_uuid uuid, target_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  selected_service public.services;
  schedule record;
  slots jsonb := '[]'::jsonb;
  staff_members jsonb := '[]'::jsonb;
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
  into selected_service
  from public.services
  where id = service_uuid
    and salon_id = customer_profile.salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  select *
  into schedule
  from public.get_salon_schedule_context(customer_profile.salon_id, target_day);

  if schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  with slot_summary as (
    select
      available_slot.staff_member_id,
      count(*)::int as available_slots_count,
      min(available_slot.start_at) as next_available_at
    from public.get_available_staff_slots_for_service(selected_service.id, target_day) available_slot
    group by available_slot.staff_member_id
  ),
  block_summary as (
    select
      sb.staff_member_id,
      jsonb_agg(
        jsonb_build_object(
          'starts_at', sb.starts_at,
          'ends_at', sb.ends_at,
          'reason', sb.reason
        )
        order by sb.starts_at
      ) as blocked_ranges
    from public.staff_blocks sb
    where sb.salon_id = customer_profile.salon_id
      and schedule.opens_at_utc is not null
      and schedule.closes_at_utc is not null
      and tstzrange(sb.starts_at, sb.ends_at, '[)') && tstzrange(schedule.opens_at_utc, schedule.closes_at_utc, '[)')
    group by sb.staff_member_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sm.id,
        'name', sm.name,
        'role', sm.role,
        'is_open', coalesce(gssc.is_open, false),
        'opens_at', gssc.opens_at,
        'closes_at', gssc.closes_at,
        'available_slots_count', coalesce(slot_summary.available_slots_count, 0),
        'next_available_at', slot_summary.next_available_at,
        'blocked_ranges', coalesce(block_summary.blocked_ranges, '[]'::jsonb),
        'status', case
          when not coalesce(gssc.is_open, false) then 'off'
          when coalesce(slot_summary.available_slots_count, 0) > 0 then 'available'
          else 'busy'
        end,
        'status_detail', case
          when not coalesce(gssc.is_open, false) then 'Nao atende nesta data.'
          when coalesce(slot_summary.available_slots_count, 0) > 0 and gssc.opens_at is not null and gssc.closes_at is not null
            then format(
              'Atende de %s as %s.',
              to_char(gssc.opens_at, 'HH24:MI'),
              to_char(gssc.closes_at, 'HH24:MI')
            )
          when jsonb_array_length(coalesce(block_summary.blocked_ranges, '[]'::jsonb)) > 0
            then 'Agenda com pausas ou bloqueios nessa data.'
          else 'Sem horarios livres nesta data.'
        end
      )
      order by sm.name
    ),
    '[]'::jsonb
  )
  into staff_members
  from public.staff_members sm
  join public.staff_service_assignments ssa
    on ssa.staff_member_id = sm.id
  left join lateral public.get_staff_schedule_context(sm.id, target_day) gssc on true
  left join slot_summary
    on slot_summary.staff_member_id = sm.id
  left join block_summary
    on block_summary.staff_member_id = sm.id
  where sm.salon_id = customer_profile.salon_id
    and sm.is_active
    and ssa.service_id = selected_service.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'start_at', start_at,
        'ends_at', ends_at,
        'staff_member_id', staff_member_id,
        'staff_member_name', staff_member_name
      )
      order by start_at, staff_member_name
    ),
    '[]'::jsonb
  )
  into slots
  from public.get_available_staff_slots_for_service(selected_service.id, target_day);

  return jsonb_build_object(
    'target_day', target_day,
    'timezone', schedule.timezone,
    'slot_step_minutes', schedule.slot_step_minutes,
    'service_duration', selected_service.duration,
    'is_open', schedule.is_open,
    'opens_at', schedule.opens_at,
    'closes_at', schedule.closes_at,
    'staff_members', staff_members,
    'available_slots', slots
  );
end;
$$;

grant execute on function public.get_staff_schedule_context(uuid, date) to authenticated;
grant execute on function public.get_day_availability(uuid, date) to authenticated;

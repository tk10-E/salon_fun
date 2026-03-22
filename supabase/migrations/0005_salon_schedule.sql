alter table public.salons
add column if not exists timezone text not null default 'America/Sao_Paulo',
add column if not exists slot_step_minutes integer not null default 30;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_slot_step_minutes_check'
  ) then
    alter table public.salons
    add constraint salons_slot_step_minutes_check
    check (slot_step_minutes in (15, 30, 60));
  end if;
end;
$$;

create table if not exists public.salon_business_hours (
  salon_id uuid not null references public.salons (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (salon_id, weekday),
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

create index if not exists salon_business_hours_salon_id_idx
on public.salon_business_hours (salon_id, weekday);

create or replace function public.touch_salon_business_hours_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_business_hours_touch_updated_at on public.salon_business_hours;

create trigger salon_business_hours_touch_updated_at
before update on public.salon_business_hours
for each row
execute function public.touch_salon_business_hours_updated_at();

create or replace function public.seed_salon_business_hours(target_salon_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.salon_business_hours (salon_id, weekday, is_open, opens_at, closes_at)
  values
    (target_salon_id, 0, false, null, null),
    (target_salon_id, 1, true, '09:00', '18:00'),
    (target_salon_id, 2, true, '09:00', '18:00'),
    (target_salon_id, 3, true, '09:00', '18:00'),
    (target_salon_id, 4, true, '09:00', '18:00'),
    (target_salon_id, 5, true, '09:00', '18:00'),
    (target_salon_id, 6, true, '09:00', '18:00')
  on conflict (salon_id, weekday) do nothing;
end;
$$;

create or replace function public.seed_salon_business_hours_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_salon_business_hours(new.id);
  return new;
end;
$$;

drop trigger if exists salons_seed_business_hours on public.salons;

create trigger salons_seed_business_hours
after insert on public.salons
for each row
execute function public.seed_salon_business_hours_from_trigger();

select public.seed_salon_business_hours(id)
from public.salons;

alter table public.salon_business_hours enable row level security;

drop policy if exists "owners_manage_salon_business_hours" on public.salon_business_hours;
drop policy if exists "customers_read_salon_business_hours" on public.salon_business_hours;

create policy "owners_manage_salon_business_hours"
on public.salon_business_hours
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_salon_business_hours"
on public.salon_business_hours
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

create or replace function public.get_salon_schedule_context(target_salon_id uuid, target_day date)
returns table (
  salon_id uuid,
  timezone text,
  slot_step_minutes integer,
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
    s.id,
    s.timezone,
    s.slot_step_minutes,
    h.is_open,
    h.opens_at,
    h.closes_at,
    case
      when h.is_open then ((target_day::timestamp + h.opens_at) at time zone s.timezone)
      else null
    end as opens_at_utc,
    case
      when h.is_open then ((target_day::timestamp + h.closes_at) at time zone s.timezone)
      else null
    end as closes_at_utc
  from public.salons s
  join public.salon_business_hours h
    on h.salon_id = s.id
   and h.weekday = extract(dow from target_day)::int
  where s.id = target_salon_id;
$$;

create or replace function public.get_available_slots_for_salon(
  target_salon_id uuid,
  service_duration integer,
  target_day date
)
returns table (start_at timestamptz, ends_at timestamptz)
language sql
security definer
set search_path = public
as $$
  with schedule as (
    select *
    from public.get_salon_schedule_context(target_salon_id, target_day)
  )
  select
    slot.start_at,
    slot.start_at + make_interval(mins => service_duration) as ends_at
  from schedule
  cross join lateral generate_series(
    schedule.opens_at_utc,
    schedule.closes_at_utc - make_interval(mins => service_duration),
    make_interval(mins => schedule.slot_step_minutes)
  ) as slot(start_at)
  where schedule.is_open
    and schedule.opens_at_utc is not null
    and schedule.closes_at_utc is not null
    and slot.start_at > timezone('utc', now())
    and not exists (
      select 1
      from public.appointments a
      where a.salon_id = target_salon_id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.date, a.ends_at, '[)') && tstzrange(
          slot.start_at,
          slot.start_at + make_interval(mins => service_duration),
          '[)'
        )
    )
  order by slot.start_at;
$$;

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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'start_at', start_at,
        'ends_at', ends_at
      )
      order by start_at
    ),
    '[]'::jsonb
  )
  into slots
  from public.get_available_slots_for_salon(
    customer_profile.salon_id,
    selected_service.duration,
    target_day
  );

  return jsonb_build_object(
    'target_day', target_day,
    'timezone', schedule.timezone,
    'slot_step_minutes', schedule.slot_step_minutes,
    'service_duration', selected_service.duration,
    'is_open', schedule.is_open,
    'opens_at', schedule.opens_at,
    'closes_at', schedule.closes_at,
    'available_slots', slots
  );
end;
$$;

create or replace function public.create_appointment(service_uuid uuid, requested_date timestamptz)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  selected_service public.services;
  created_appointment public.appointments;
  requested_end timestamptz;
  local_requested_day date;
  schedule record;
  requested_salon_timezone text;
  requested_slot_available boolean;
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

  select timezone
  into requested_salon_timezone
  from public.salons
  where id = customer_profile.salon_id;

  if requested_salon_timezone is null then
    raise exception 'schedule_not_found';
  end if;

  local_requested_day := (requested_date at time zone requested_salon_timezone)::date;

  select *
  into schedule
  from public.get_salon_schedule_context(customer_profile.salon_id, local_requested_day);

  if schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  if not schedule.is_open then
    raise exception 'salon_closed_on_selected_day';
  end if;

  if requested_date <= timezone('utc', now()) then
    raise exception 'past_time_not_allowed';
  end if;

  requested_end := requested_date + make_interval(mins => selected_service.duration);

  if requested_date < schedule.opens_at_utc or requested_end > schedule.closes_at_utc then
    raise exception 'outside_business_hours';
  end if;

  if mod(
    extract(epoch from requested_date - schedule.opens_at_utc)::bigint,
    (schedule.slot_step_minutes * 60)::bigint
  ) <> 0 then
    raise exception 'slot_step_mismatch';
  end if;

  select exists (
    select 1
    from public.get_available_slots_for_salon(
      customer_profile.salon_id,
      selected_service.duration,
      local_requested_day
    ) available_slot
    where available_slot.start_at = requested_date
  )
  into requested_slot_available;

  if not requested_slot_available then
    raise exception 'time_slot_unavailable';
  end if;

  insert into public.appointments (salon_id, customer_id, service_id, date, ends_at, status)
  values (
    customer_profile.salon_id,
    customer_profile.id,
    selected_service.id,
    requested_date,
    requested_end,
    'pending'
  )
  returning * into created_appointment;

  return created_appointment;
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

grant execute on function public.get_day_availability(uuid, date) to authenticated;

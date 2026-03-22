create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null,
  role text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(name)) > 0)
);

create unique index if not exists staff_members_default_per_salon_idx
on public.staff_members (salon_id)
where is_default;

create index if not exists staff_members_salon_id_idx
on public.staff_members (salon_id, is_active, name);

create table if not exists public.staff_service_assignments (
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (staff_member_id, service_id)
);

create index if not exists staff_service_assignments_service_id_idx
on public.staff_service_assignments (service_id);

create table if not exists public.staff_blocks (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at),
  check (reason is null or char_length(btrim(reason)) <= 180)
);

create index if not exists staff_blocks_staff_member_id_idx
on public.staff_blocks (staff_member_id, starts_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_blocks_no_overlap'
  ) then
    alter table public.staff_blocks
    add constraint staff_blocks_no_overlap
    exclude using gist (
      staff_member_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    );
  end if;
end;
$$;

create or replace function public.touch_staff_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists staff_members_touch_updated_at on public.staff_members;

create trigger staff_members_touch_updated_at
before update on public.staff_members
for each row
execute function public.touch_staff_members_updated_at();

create or replace function public.seed_default_staff_member(target_salon_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_default_staff_id uuid;
begin
  select id
  into existing_default_staff_id
  from public.staff_members
  where salon_id = target_salon_id
    and is_default
  limit 1;

  if existing_default_staff_id is not null then
    return existing_default_staff_id;
  end if;

  insert into public.staff_members (salon_id, name, role, is_active, is_default)
  values (target_salon_id, 'Equipe principal', 'Atendimento', true, true)
  returning id into existing_default_staff_id;

  return existing_default_staff_id;
end;
$$;

create or replace function public.seed_default_staff_member_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_staff_member(new.id);
  return new;
end;
$$;

drop trigger if exists salons_seed_default_staff on public.salons;

create trigger salons_seed_default_staff
after insert on public.salons
for each row
execute function public.seed_default_staff_member_from_trigger();

select public.seed_default_staff_member(id)
from public.salons;

create or replace function public.sync_staff_service_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  staff_salon_id uuid;
  service_salon_id uuid;
begin
  select salon_id into staff_salon_id
  from public.staff_members
  where id = new.staff_member_id;

  select salon_id into service_salon_id
  from public.services
  where id = new.service_id;

  if staff_salon_id is null or service_salon_id is null then
    raise exception 'invalid_staff_service_assignment';
  end if;

  if staff_salon_id <> service_salon_id then
    raise exception 'staff_and_service_must_belong_to_same_salon';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_service_assignments_sync on public.staff_service_assignments;

create trigger staff_service_assignments_sync
before insert or update of staff_member_id, service_id
on public.staff_service_assignments
for each row
execute function public.sync_staff_service_assignment();

create or replace function public.sync_staff_block_salon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  staff_salon_id uuid;
begin
  select salon_id into staff_salon_id
  from public.staff_members
  where id = new.staff_member_id;

  if staff_salon_id is null then
    raise exception 'staff_member_not_found';
  end if;

  new.salon_id := staff_salon_id;
  new.reason := nullif(btrim(coalesce(new.reason, '')), '');
  return new;
end;
$$;

drop trigger if exists staff_blocks_sync_salon on public.staff_blocks;

create trigger staff_blocks_sync_salon
before insert or update of staff_member_id, reason
on public.staff_blocks
for each row
execute function public.sync_staff_block_salon();

create or replace function public.assign_service_to_active_staff_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_service_assignments (staff_member_id, service_id)
  select sm.id, new.id
  from public.staff_members sm
  where sm.salon_id = new.salon_id
    and sm.is_active
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists services_assign_active_staff on public.services;

create trigger services_assign_active_staff
after insert on public.services
for each row
execute function public.assign_service_to_active_staff_members();

insert into public.staff_service_assignments (staff_member_id, service_id)
select distinct sm.id, s.id
from public.services s
join public.staff_members sm
  on sm.salon_id = s.salon_id
 and sm.is_default
on conflict do nothing;

alter table public.appointments
add column if not exists staff_member_id uuid references public.staff_members (id) on delete restrict;

update public.appointments a
set staff_member_id = sm.id
from public.staff_members sm
where sm.salon_id = a.salon_id
  and sm.is_default
  and a.staff_member_id is null;

alter table public.appointments
alter column staff_member_id set not null;

create index if not exists appointments_staff_member_id_idx
on public.appointments (staff_member_id, date);

alter table public.appointments
drop constraint if exists appointments_no_overlap;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_no_staff_overlap'
  ) then
    alter table public.appointments
    add constraint appointments_no_staff_overlap
    exclude using gist (
      staff_member_id with =,
      tstzrange(date, ends_at, '[)') with &&
    )
    where (status in ('pending', 'confirmed'));
  end if;
end;
$$;

create or replace function public.sync_appointment_salon()
returns trigger
language plpgsql
as $$
declare
  service_salon_id uuid;
  customer_salon_id uuid;
  staff_salon_id uuid;
  assignment_exists boolean;
begin
  select salon_id into service_salon_id
  from public.services
  where id = new.service_id;

  select salon_id into customer_salon_id
  from public.customers
  where id = new.customer_id;

  select salon_id into staff_salon_id
  from public.staff_members
  where id = new.staff_member_id;

  if service_salon_id is null or customer_salon_id is null or staff_salon_id is null then
    raise exception 'invalid_appointment_links';
  end if;

  if service_salon_id <> customer_salon_id or service_salon_id <> staff_salon_id then
    raise exception 'service_customer_and_staff_must_belong_to_same_salon';
  end if;

  select exists (
    select 1
    from public.staff_service_assignments
    where staff_member_id = new.staff_member_id
      and service_id = new.service_id
  )
  into assignment_exists;

  if not assignment_exists then
    raise exception 'staff_member_cannot_perform_service';
  end if;

  new.salon_id := service_salon_id;
  return new;
end;
$$;

drop trigger if exists appointments_sync_salon on public.appointments;

create trigger appointments_sync_salon
before insert or update of customer_id, service_id, staff_member_id
on public.appointments
for each row
execute function public.sync_appointment_salon();

alter table public.staff_members enable row level security;
alter table public.staff_service_assignments enable row level security;
alter table public.staff_blocks enable row level security;

drop policy if exists "owners_manage_staff_members" on public.staff_members;
drop policy if exists "customers_read_staff_members" on public.staff_members;
drop policy if exists "owners_manage_staff_service_assignments" on public.staff_service_assignments;
drop policy if exists "customers_read_staff_service_assignments" on public.staff_service_assignments;
drop policy if exists "owners_manage_staff_blocks" on public.staff_blocks;

create policy "owners_manage_staff_members"
on public.staff_members
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_staff_members"
on public.staff_members
for select
to authenticated
using (public.is_customer_of_salon(salon_id) and is_active);

create policy "owners_manage_staff_service_assignments"
on public.staff_service_assignments
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
    join public.services s
      on s.id = service_id
    where sm.id = staff_member_id
      and sm.salon_id = s.salon_id
      and public.is_owner_of_salon(sm.salon_id)
  )
);

create policy "customers_read_staff_service_assignments"
on public.staff_service_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_members sm
    where sm.id = staff_member_id
      and sm.is_active
      and public.is_customer_of_salon(sm.salon_id)
  )
);

create policy "owners_manage_staff_blocks"
on public.staff_blocks
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

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
    select sm.id, sm.name
    from service_context sc
    join public.staff_service_assignments ssa
      on ssa.service_id = sc.service_id
    join public.staff_members sm
      on sm.id = ssa.staff_member_id
    where sm.is_active
  )
  select
    slot.start_at,
    slot.start_at + make_interval(mins => schedule.duration) as ends_at,
    eligible_staff.id,
    eligible_staff.name
  from schedule
  join eligible_staff on true
  cross join lateral generate_series(
    schedule.opens_at_utc,
    schedule.closes_at_utc - make_interval(mins => schedule.duration),
    make_interval(mins => schedule.slot_step_minutes)
  ) as slot(start_at)
  where schedule.is_open
    and schedule.opens_at_utc is not null
    and schedule.closes_at_utc is not null
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sm.id,
        'name', sm.name,
        'role', sm.role
      )
      order by sm.name
    ),
    '[]'::jsonb
  )
  into staff_members
  from public.staff_members sm
  join public.staff_service_assignments ssa
    on ssa.staff_member_id = sm.id
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

drop function if exists public.create_appointment(uuid, timestamptz);

create or replace function public.create_appointment(
  service_uuid uuid,
  requested_date timestamptz,
  preferred_staff_member_uuid uuid default null
)
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
  resolved_staff_member_id uuid;
  preferred_staff_valid boolean;
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

  if preferred_staff_member_uuid is not null then
    select exists (
      select 1
      from public.staff_members sm
      join public.staff_service_assignments ssa
        on ssa.staff_member_id = sm.id
      where sm.id = preferred_staff_member_uuid
        and sm.salon_id = customer_profile.salon_id
        and sm.is_active
        and ssa.service_id = selected_service.id
    )
    into preferred_staff_valid;

    if not preferred_staff_valid then
      raise exception 'staff_member_not_available_for_service';
    end if;
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

  select available_slot.staff_member_id
  into resolved_staff_member_id
  from public.get_available_staff_slots_for_service(selected_service.id, local_requested_day) available_slot
  where available_slot.start_at = requested_date
    and (
      preferred_staff_member_uuid is null
      or available_slot.staff_member_id = preferred_staff_member_uuid
    )
  order by available_slot.staff_member_name
  limit 1;

  if resolved_staff_member_id is null then
    raise exception 'time_slot_unavailable';
  end if;

  insert into public.appointments (salon_id, customer_id, service_id, staff_member_id, date, ends_at, status)
  values (
    customer_profile.salon_id,
    customer_profile.id,
    selected_service.id,
    resolved_staff_member_id,
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

create or replace function public.create_staff_block(
  staff_member_uuid uuid,
  local_start timestamp,
  local_end timestamp,
  block_reason text default null
)
returns public.staff_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  target_staff public.staff_members;
  salon_timezone text;
  created_block public.staff_blocks;
begin
  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'unauthorized';
  end if;

  select *
  into target_staff
  from public.staff_members
  where id = staff_member_uuid
    and salon_id = owner_salon_id;

  if target_staff.id is null then
    raise exception 'staff_member_not_found';
  end if;

  if local_start is null or local_end is null or local_end <= local_start then
    raise exception 'invalid_block_range';
  end if;

  select timezone into salon_timezone
  from public.salons
  where id = owner_salon_id;

  insert into public.staff_blocks (salon_id, staff_member_id, starts_at, ends_at, reason)
  values (
    owner_salon_id,
    target_staff.id,
    local_start at time zone salon_timezone,
    local_end at time zone salon_timezone,
    nullif(btrim(coalesce(block_reason, '')), '')
  )
  returning * into created_block;

  return created_block;
exception
  when exclusion_violation then
    raise exception 'staff_block_overlap';
end;
$$;

grant execute on function public.create_appointment(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.get_day_availability(uuid, date) to authenticated;
grant execute on function public.create_staff_block(uuid, timestamp, timestamp, text) to authenticated;

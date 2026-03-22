alter table public.appointments
add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_completed_state_check'
  ) then
    alter table public.appointments
    add constraint appointments_completed_state_check
    check (
      (
        status = 'completed'
        and completed_at is not null
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
      or (
        status <> 'completed'
        and completed_at is null
      )
    );
  end if;
end;
$$;

create index if not exists appointments_status_date_idx
on public.appointments (salon_id, status, date);

alter table public.customers
add column if not exists referral_code text,
add column if not exists referred_by_customer_id uuid references public.customers (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_referred_by_self_check'
  ) then
    alter table public.customers
    add constraint customers_referred_by_self_check
    check (referred_by_customer_id is null or referred_by_customer_id <> id);
  end if;
end;
$$;

create unique index if not exists customers_referral_code_key
on public.customers (referral_code)
where referral_code is not null;

create index if not exists customers_referred_by_customer_id_idx
on public.customers (referred_by_customer_id);

create or replace function public.generate_customer_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    generated_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

    exit when not exists (
      select 1
      from public.customers
      where referral_code = generated_code
    );

    if attempts > 50 then
      raise exception 'could_not_generate_referral_code';
    end if;
  end loop;

  return generated_code;
end;
$$;

create or replace function public.assign_customer_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    new.referral_code := public.generate_customer_referral_code();
  else
    new.referral_code := upper(btrim(new.referral_code));
  end if;

  return new;
end;
$$;

drop trigger if exists customers_assign_referral_code on public.customers;

create trigger customers_assign_referral_code
before insert on public.customers
for each row
execute function public.assign_customer_referral_code();

update public.customers
set referral_code = public.generate_customer_referral_code()
where referral_code is null
   or btrim(referral_code) = '';

create table if not exists public.salon_offers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  kind text not null check (kind in ('promotion', 'membership')),
  title text not null,
  description text,
  highlight_text text,
  price numeric(10, 2) check (price is null or price >= 0),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(title)) between 1 and 120),
  check (description is null or char_length(btrim(description)) between 1 and 500),
  check (highlight_text is null or char_length(btrim(highlight_text)) between 1 and 120),
  check (sort_order >= 0),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create index if not exists salon_offers_salon_id_idx
on public.salon_offers (salon_id, kind, is_active, sort_order, created_at desc);

create or replace function public.touch_salon_offer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_offers_touch_updated_at on public.salon_offers;

create trigger salon_offers_touch_updated_at
before update on public.salon_offers
for each row
execute function public.touch_salon_offer_updated_at();

alter table public.salon_offers enable row level security;

drop policy if exists "owners_manage_salon_offers" on public.salon_offers;
drop policy if exists "customers_read_salon_offers" on public.salon_offers;

create policy "owners_manage_salon_offers"
on public.salon_offers
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_salon_offers"
on public.salon_offers
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

create table if not exists public.salon_referral_programs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references public.salons (id) on delete cascade,
  title text not null default 'Indique e ganhe',
  description text,
  reward_for_referrer text not null default 'Benefício liberado após a primeira visita da indicação.',
  reward_for_invited text,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(title)) between 1 and 120),
  check (description is null or char_length(btrim(description)) between 1 and 500),
  check (char_length(btrim(reward_for_referrer)) between 1 and 220),
  check (reward_for_invited is null or char_length(btrim(reward_for_invited)) between 1 and 220)
);

create or replace function public.touch_salon_referral_program_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_referral_programs_touch_updated_at on public.salon_referral_programs;

create trigger salon_referral_programs_touch_updated_at
before update on public.salon_referral_programs
for each row
execute function public.touch_salon_referral_program_updated_at();

alter table public.salon_referral_programs enable row level security;

drop policy if exists "owners_manage_salon_referral_programs" on public.salon_referral_programs;
drop policy if exists "customers_read_salon_referral_programs" on public.salon_referral_programs;

create policy "owners_manage_salon_referral_programs"
on public.salon_referral_programs
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_salon_referral_programs"
on public.salon_referral_programs
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

create table if not exists public.salon_referral_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  referral_program_id uuid references public.salon_referral_programs (id) on delete set null,
  referrer_customer_id uuid not null references public.customers (id) on delete cascade,
  invited_customer_id uuid not null unique references public.customers (id) on delete cascade,
  qualifying_appointment_id uuid unique references public.appointments (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'qualified')),
  qualified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (
      status = 'qualified'
      and qualified_at is not null
      and qualifying_appointment_id is not null
    )
    or (
      status = 'pending'
      and qualified_at is null
    )
  )
);

create index if not exists salon_referral_events_salon_status_idx
on public.salon_referral_events (salon_id, status, created_at desc);

create index if not exists salon_referral_events_referrer_idx
on public.salon_referral_events (referrer_customer_id, status, created_at desc);

alter table public.salon_referral_events enable row level security;

drop policy if exists "owners_manage_salon_referral_events" on public.salon_referral_events;
drop policy if exists "customers_read_own_salon_referral_events" on public.salon_referral_events;

create policy "owners_manage_salon_referral_events"
on public.salon_referral_events
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_salon_referral_events"
on public.salon_referral_events
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.auth_user_id = auth.uid()
      and (c.id = referrer_customer_id or c.id = invited_customer_id)
  )
);

create or replace function public.qualify_referral_from_completed_appointment(
  appointment_uuid uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_appointment public.appointments;
  invited_customer public.customers;
begin
  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null or target_appointment.status <> 'completed' then
    return;
  end if;

  select *
  into invited_customer
  from public.customers
  where id = target_appointment.customer_id;

  if invited_customer.id is null or invited_customer.referred_by_customer_id is null then
    return;
  end if;

  update public.salon_referral_events
  set
    status = 'qualified',
    qualified_at = timezone('utc', now()),
    qualifying_appointment_id = target_appointment.id
  where salon_id = target_appointment.salon_id
    and invited_customer_id = invited_customer.id
    and status = 'pending'
    and qualified_at is null;
end;
$$;

create or replace function public.handle_appointment_referral_qualification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    perform public.qualify_referral_from_completed_appointment(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_qualify_referrals on public.appointments;

create trigger appointments_qualify_referrals
after update of status on public.appointments
for each row
execute function public.handle_appointment_referral_qualification();

create or replace function public.mark_appointment_completed(
  appointment_uuid uuid
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_appointment public.appointments;
  completed_appointment public.appointments;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if not public.is_owner_of_salon(target_appointment.salon_id) then
    raise exception 'unauthorized';
  end if;

  if target_appointment.status = 'cancelled' then
    raise exception 'cancelled_appointment_cannot_be_completed';
  end if;

  if target_appointment.status = 'completed' then
    raise exception 'appointment_already_completed';
  end if;

  if target_appointment.ends_at > timezone('utc', now()) then
    raise exception 'appointment_not_finished';
  end if;

  update public.appointments
  set
    status = 'completed',
    completed_at = timezone('utc', now()),
    cancelled_at = null,
    cancelled_by = null,
    cancellation_reason = null
  where id = target_appointment.id
  returning * into completed_appointment;

  delete from public.salon_vacancy_alerts
  where appointment_id = target_appointment.id;

  return completed_appointment;
end;
$$;

grant execute on function public.mark_appointment_completed(uuid) to authenticated;

create or replace function public.get_customer_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  customer_profile public.customers;
  active_program public.salon_referral_programs;
  pending_count integer := 0;
  qualified_count integer := 0;
  referrals jsonb := '[]'::jsonb;
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
  into active_program
  from public.salon_referral_programs
  where salon_id = customer_profile.salon_id
    and is_active
  order by updated_at desc
  limit 1;

  select
    count(*) filter (where status = 'pending')::int,
    count(*) filter (where status = 'qualified')::int
  into pending_count, qualified_count
  from public.salon_referral_events
  where referrer_customer_id = customer_profile.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'customer_name', coalesce(invited.name, 'Cliente'),
        'status', event.status,
        'qualified_at', event.qualified_at,
        'created_at', event.created_at
      )
      order by event.created_at desc
    ),
    '[]'::jsonb
  )
  into referrals
  from public.salon_referral_events event
  left join public.customers invited
    on invited.id = event.invited_customer_id
  where event.referrer_customer_id = customer_profile.id;

  return jsonb_build_object(
    'referral_code', customer_profile.referral_code,
    'pending_count', pending_count,
    'qualified_count', qualified_count,
    'program',
    case
      when active_program.id is null then null
      else jsonb_build_object(
        'title', active_program.title,
        'description', active_program.description,
        'reward_for_referrer', active_program.reward_for_referrer,
        'reward_for_invited', active_program.reward_for_invited,
        'is_active', active_program.is_active
      )
    end,
    'referrals', referrals
  );
end;
$$;

grant execute on function public.get_customer_referral_summary() to authenticated;

create or replace function public.join_salon(
  input_join_code text,
  customer_name text,
  referral_code_input text
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_salon public.salons;
  existing_customer public.customers;
  linked_customer public.customers;
  referrer_customer public.customers;
  active_program public.salon_referral_programs;
  normalized_referral_code text;
  existing_appointments_count bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if trim(coalesce(customer_name, '')) = '' then
    raise exception 'customer_name_required';
  end if;

  select *
  into target_salon
  from public.salons
  where public.salons.join_code = upper(trim(input_join_code));

  if target_salon.id is null then
    raise exception 'invalid_salon_code';
  end if;

  select *
  into existing_customer
  from public.customers
  where auth_user_id = auth.uid();

  if existing_customer.id is not null and existing_customer.salon_id <> target_salon.id then
    raise exception 'customer_already_linked_to_another_salon';
  end if;

  normalized_referral_code := upper(nullif(btrim(coalesce(referral_code_input, '')), ''));

  if normalized_referral_code is not null then
    if existing_customer.id is not null and existing_customer.referred_by_customer_id is not null then
      raise exception 'referral_already_registered';
    end if;

    if existing_customer.id is not null then
      select count(*)
      into existing_appointments_count
      from public.appointments
      where customer_id = existing_customer.id;

      if existing_appointments_count > 0 then
        raise exception 'referral_code_too_late';
      end if;
    end if;

    select *
    into active_program
    from public.salon_referral_programs
    where salon_id = target_salon.id
      and is_active
    order by updated_at desc
    limit 1;

    if active_program.id is null then
      raise exception 'referral_program_inactive';
    end if;

    select *
    into referrer_customer
    from public.customers
    where salon_id = target_salon.id
      and referral_code = normalized_referral_code;

    if referrer_customer.id is null then
      raise exception 'invalid_referral_code';
    end if;

    if referrer_customer.auth_user_id = auth.uid() then
      raise exception 'cannot_refer_yourself';
    end if;
  end if;

  insert into public.customers (salon_id, auth_user_id, name, referred_by_customer_id)
  values (
    target_salon.id,
    auth.uid(),
    trim(customer_name),
    case when referrer_customer.id is null then null else referrer_customer.id end
  )
  on conflict (auth_user_id)
  do update
  set
    name = excluded.name,
    referred_by_customer_id = coalesce(public.customers.referred_by_customer_id, excluded.referred_by_customer_id)
  returning * into linked_customer;

  if referrer_customer.id is not null and linked_customer.referred_by_customer_id = referrer_customer.id then
    insert into public.salon_referral_events (
      salon_id,
      referral_program_id,
      referrer_customer_id,
      invited_customer_id,
      status
    )
    values (
      target_salon.id,
      active_program.id,
      referrer_customer.id,
      linked_customer.id,
      'pending'
    )
    on conflict (invited_customer_id) do nothing;
  end if;

  return linked_customer;
end;
$$;

create or replace function public.join_salon(
  input_join_code text,
  customer_name text
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.join_salon(input_join_code, customer_name, null::text);
end;
$$;

create or replace function public.cancel_appointment(
  appointment_uuid uuid,
  cancellation_reason_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_appointment public.appointments;
  customer_profile public.customers;
  actor text;
  normalized_reason text;
  cancelled_appointment public.appointments;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.status = 'cancelled' then
    raise exception 'appointment_already_cancelled';
  end if;

  if target_appointment.status = 'completed' then
    raise exception 'appointment_already_completed';
  end if;

  if target_appointment.ends_at <= timezone('utc', now()) then
    raise exception 'past_appointment_cannot_be_cancelled';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid();

  if customer_profile.id = target_appointment.customer_id then
    actor := 'customer';
  elsif public.is_owner_of_salon(target_appointment.salon_id) then
    actor := 'salon';
  else
    raise exception 'unauthorized';
  end if;

  normalized_reason := nullif(btrim(coalesce(cancellation_reason_input, '')), '');

  if actor = 'customer' and normalized_reason is null then
    raise exception 'cancellation_reason_required';
  end if;

  if actor = 'salon' and normalized_reason is null then
    normalized_reason := 'Cancelado pelo salão.';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    completed_at = null,
    cancelled_at = timezone('utc', now()),
    cancelled_by = actor,
    cancellation_reason = normalized_reason
  where id = target_appointment.id
  returning * into cancelled_appointment;

  if cancelled_appointment.date > timezone('utc', now()) then
    perform public.create_vacancy_alert_for_appointment(cancelled_appointment.id, actor);
  end if;

  return cancelled_appointment;
end;
$$;

grant execute on function public.join_salon(text, text) to authenticated;
grant execute on function public.join_salon(text, text, text) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;

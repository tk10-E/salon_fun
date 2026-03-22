alter table public.appointments
add column if not exists cancelled_at timestamptz,
add column if not exists cancelled_by text,
add column if not exists cancellation_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_cancelled_by_check'
  ) then
    alter table public.appointments
    add constraint appointments_cancelled_by_check
    check (
      cancelled_by is null
      or cancelled_by in ('customer', 'salon')
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_cancellation_reason_length_check'
  ) then
    alter table public.appointments
    add constraint appointments_cancellation_reason_length_check
    check (
      cancellation_reason is null
      or char_length(btrim(cancellation_reason)) between 1 and 300
    );
  end if;
end;
$$;

create table if not exists public.salon_vacancy_alerts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  headline text not null,
  body text not null,
  created_by text not null check (created_by in ('customer', 'salon')),
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at),
  check (char_length(btrim(headline)) between 1 and 140),
  check (char_length(btrim(body)) between 1 and 280)
);

create index if not exists salon_vacancy_alerts_salon_id_idx
on public.salon_vacancy_alerts (salon_id, starts_at, created_at desc);

alter table public.salon_vacancy_alerts enable row level security;

drop policy if exists "owners_manage_salon_vacancy_alerts" on public.salon_vacancy_alerts;
drop policy if exists "customers_read_salon_vacancy_alerts" on public.salon_vacancy_alerts;

create policy "owners_manage_salon_vacancy_alerts"
on public.salon_vacancy_alerts
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_salon_vacancy_alerts"
on public.salon_vacancy_alerts
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'salon_vacancy_alerts'
  ) then
    alter publication supabase_realtime add table public.salon_vacancy_alerts;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;

create or replace function public.create_vacancy_alert_for_appointment(
  appointment_uuid uuid,
  actor text
)
returns public.salon_vacancy_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  target_appointment public.appointments;
  service_name text;
  staff_name text;
  vacancy_alert public.salon_vacancy_alerts;
begin
  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.date <= timezone('utc', now()) then
    raise exception 'past_appointment_has_no_vacancy_alert';
  end if;

  select name into service_name
  from public.services
  where id = target_appointment.service_id;

  select name into staff_name
  from public.staff_members
  where id = target_appointment.staff_member_id;

  insert into public.salon_vacancy_alerts (
    salon_id,
    appointment_id,
    service_id,
    staff_member_id,
    starts_at,
    ends_at,
    headline,
    body,
    created_by
  )
  values (
    target_appointment.salon_id,
    target_appointment.id,
    target_appointment.service_id,
    target_appointment.staff_member_id,
    target_appointment.date,
    target_appointment.ends_at,
    'Horario liberado',
    format(
      'Um horario para %s com %s ficou livre em %s.',
      coalesce(service_name, 'servico'),
      coalesce(staff_name, 'a equipe do salao'),
      to_char(target_appointment.date at time zone coalesce(
        (select timezone from public.salons where id = target_appointment.salon_id),
        'America/Sao_Paulo'
      ), 'DD/MM "as" HH24:MI')
    ),
    actor
  )
  on conflict (appointment_id) do update
  set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    headline = excluded.headline,
    body = excluded.body,
    created_by = excluded.created_by,
    created_at = timezone('utc', now())
  returning * into vacancy_alert;

  return vacancy_alert;
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
    normalized_reason := 'Cancelado pelo salao.';
  end if;

  update public.appointments
  set
    status = 'cancelled',
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

grant execute on function public.cancel_appointment(uuid, text) to authenticated;

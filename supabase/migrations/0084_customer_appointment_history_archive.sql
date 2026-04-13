alter table public.appointments
add column if not exists customer_archived_at timestamptz;

create index if not exists appointments_customer_visible_history_idx
on public.appointments (customer_id, customer_archived_at, date desc);

create or replace function public.archive_customer_appointment(appointment_uuid uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  target_appointment public.appointments;
  archived_appointment public.appointments;
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
  into target_appointment
  from public.appointments
  where id = appointment_uuid
    and customer_id = customer_profile.id;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.status::text not in ('cancelled', 'completed', 'no_show')
    and coalesce(target_appointment.ends_at, target_appointment.date) > timezone('utc', now()) then
    raise exception 'appointment_not_ready_for_history_archive';
  end if;

  update public.appointments
  set customer_archived_at = timezone('utc', now())
  where id = target_appointment.id
  returning * into archived_appointment;

  return archived_appointment;
end;
$$;

grant execute on function public.archive_customer_appointment(uuid)
to authenticated;

create or replace function public.archive_customer_appointment_history()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  archived_count integer := 0;
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

  update public.appointments
  set customer_archived_at = timezone('utc', now())
  where customer_id = customer_profile.id
    and customer_archived_at is null
    and (
      status::text in ('cancelled', 'completed', 'no_show')
      or coalesce(ends_at, date) <= timezone('utc', now())
    );

  get diagnostics archived_count = row_count;

  return jsonb_build_object('archived_count', archived_count);
end;
$$;

grant execute on function public.archive_customer_appointment_history()
to authenticated;

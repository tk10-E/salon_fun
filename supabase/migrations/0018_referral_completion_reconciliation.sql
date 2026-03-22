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
  existing_event public.salon_referral_events;
  latest_program public.salon_referral_programs;
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

  select *
  into existing_event
  from public.salon_referral_events
  where salon_id = target_appointment.salon_id
    and invited_customer_id = invited_customer.id
  order by created_at desc
  limit 1;

  if existing_event.id is null then
    select *
    into latest_program
    from public.salon_referral_programs
    where salon_id = target_appointment.salon_id
      and is_active
    order by updated_at desc
    limit 1;

    insert into public.salon_referral_events (
      salon_id,
      referral_program_id,
      referrer_customer_id,
      invited_customer_id,
      status
    )
    values (
      target_appointment.salon_id,
      latest_program.id,
      invited_customer.referred_by_customer_id,
      invited_customer.id,
      'pending'
    )
    returning * into existing_event;
  end if;

  if existing_event.status = 'qualified' and existing_event.qualified_at is not null then
    return;
  end if;

  update public.salon_referral_events
  set
    referral_program_id = coalesce(public.salon_referral_events.referral_program_id, latest_program.id),
    referrer_customer_id = coalesce(public.salon_referral_events.referrer_customer_id, invited_customer.referred_by_customer_id),
    status = 'qualified',
    qualified_at = timezone('utc', now()),
    qualifying_appointment_id = target_appointment.id
  where id = existing_event.id;
end;
$$;

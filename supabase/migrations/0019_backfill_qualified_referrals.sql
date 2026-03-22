do $$
declare
  completed_appointment record;
begin
  for completed_appointment in
    select id
    from public.appointments
    where status = 'completed'
  loop
    perform public.qualify_referral_from_completed_appointment(completed_appointment.id);
  end loop;
end;
$$;

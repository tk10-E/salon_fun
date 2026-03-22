create or replace function public.handle_appointment_referral_qualification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'::public.appointment_status then
    perform public.qualify_referral_from_completed_appointment(new.id);
  end if;

  return new;
end;
$$;

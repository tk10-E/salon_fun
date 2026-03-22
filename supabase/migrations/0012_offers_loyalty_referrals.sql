do $$
begin
  alter type public.appointment_status add value if not exists 'completed';
exception
  when duplicate_object then
    null;
end;
$$;

create or replace function public.assign_service_to_active_staff_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.staff_members sm
    where sm.salon_id = new.salon_id
      and sm.is_active
      and not sm.is_default
  ) then
    return new;
  end if;

  insert into public.staff_service_assignments (staff_member_id, service_id)
  select sm.id, new.id
  from public.staff_members sm
  where sm.salon_id = new.salon_id
    and sm.is_active
    and sm.is_default
  on conflict do nothing;

  return new;
end;
$$;

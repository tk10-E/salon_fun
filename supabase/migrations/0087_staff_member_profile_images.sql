alter table public.staff_members
add column if not exists image_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_members_image_path_check'
      and conrelid = 'public.staff_members'::regclass
  ) then
    alter table public.staff_members
    add constraint staff_members_image_path_check
    check (
      image_path is null
      or char_length(btrim(image_path)) between 1 and 500
    );
  end if;
end
$$;

alter table public.services
add column if not exists image_path text,
add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_sort_order_non_negative_check'
  ) then
    alter table public.services
    add constraint services_sort_order_non_negative_check
    check (sort_order >= 0);
  end if;
end
$$;

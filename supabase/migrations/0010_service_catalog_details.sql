alter table public.services
add column if not exists category text,
add column if not exists description text;

update public.services
set category = 'Geral'
where category is null or btrim(category) = '';

alter table public.services
alter column category set default 'Geral';

alter table public.services
alter column category set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_category_length_check'
  ) then
    alter table public.services
    add constraint services_category_length_check
    check (char_length(btrim(category)) between 2 and 60);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_description_length_check'
  ) then
    alter table public.services
    add constraint services_description_length_check
    check (
      description is null
      or char_length(btrim(description)) between 10 and 280
    );
  end if;
end
$$;

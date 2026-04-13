alter table public.salon_offers
add column if not exists image_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_offers_image_path_check'
      and conrelid = 'public.salon_offers'::regclass
  ) then
    alter table public.salon_offers
    add constraint salon_offers_image_path_check
    check (
      image_path is null
      or char_length(btrim(image_path)) between 1 and 500
    );
  end if;
end
$$;

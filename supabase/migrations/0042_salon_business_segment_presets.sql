alter table public.salons
add column if not exists business_segment text;

update public.salons
set business_segment = 'beauty_salon'
where business_segment is null
   or btrim(business_segment) = '';

alter table public.salons
alter column business_segment set default 'beauty_salon';

alter table public.salons
alter column business_segment set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_business_segment_check'
  ) then
    alter table public.salons
    add constraint salons_business_segment_check
    check (
      business_segment in (
        'beauty_salon',
        'nail_studio',
        'barbershop',
        'brows_lashes',
        'aesthetics_clinic'
      )
    );
  end if;
end
$$;

drop function if exists public.get_salon_join_preview(text);

create function public.get_salon_join_preview(input_join_code text)
returns table (
  salon_id uuid,
  name text,
  tagline text,
  brand_color text,
  whatsapp_phone text,
  logo_path text,
  business_segment text
)
language sql
security definer
set search_path = public
as $$
  select
    id as salon_id,
    public.salons.name,
    public.salons.tagline,
    public.salons.brand_color,
    public.salons.whatsapp_phone,
    public.salons.logo_path,
    public.salons.business_segment
  from public.salons
  where public.salons.join_code = upper(trim(input_join_code))
  limit 1;
$$;

grant execute on function public.get_salon_join_preview(text) to authenticated;

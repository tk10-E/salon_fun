create or replace function public.get_salon_join_preview(input_join_code text)
returns table (
  salon_id uuid,
  name text,
  tagline text,
  brand_color text,
  whatsapp_phone text,
  logo_path text
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
    public.salons.logo_path
  from public.salons
  where public.salons.join_code = upper(trim(input_join_code))
  limit 1;
$$;

grant execute on function public.get_salon_join_preview(text) to authenticated;

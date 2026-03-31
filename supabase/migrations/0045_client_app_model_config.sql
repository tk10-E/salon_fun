alter table public.salons
add column if not exists client_app_config jsonb;

update public.salons
set client_app_config = '{}'::jsonb
where client_app_config is null;

alter table public.salons
alter column client_app_config set default '{}'::jsonb;

alter table public.salons
alter column client_app_config set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_client_app_config_object'
  ) then
    alter table public.salons
    add constraint salons_client_app_config_object
    check (jsonb_typeof(client_app_config) = 'object');
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
  business_segment text,
  client_app_config jsonb
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
    public.salons.business_segment,
    public.salons.client_app_config
  from public.salons
  where public.salons.join_code = upper(trim(input_join_code))
  limit 1;
$$;

grant execute on function public.get_salon_join_preview(text) to authenticated;

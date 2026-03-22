alter table public.salons
add column if not exists tagline text,
add column if not exists brand_color text not null default '#C56B43',
add column if not exists whatsapp_phone text,
add column if not exists logo_path text,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_brand_color_format'
  ) then
    alter table public.salons
    add constraint salons_brand_color_format
    check (brand_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end;
$$;

create or replace function public.touch_salon_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salons_touch_updated_at on public.salons;

create trigger salons_touch_updated_at
before update on public.salons
for each row
execute function public.touch_salon_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salon-assets',
  'salon-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owners_read_their_salon_assets" on storage.objects;
drop policy if exists "owners_upload_their_salon_assets" on storage.objects;
drop policy if exists "owners_update_their_salon_assets" on storage.objects;
drop policy if exists "owners_delete_their_salon_assets" on storage.objects;

create policy "owners_read_their_salon_assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'salon-assets'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_upload_their_salon_assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'salon-assets'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_update_their_salon_assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'salon-assets'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
)
with check (
  bucket_id = 'salon-assets'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_delete_their_salon_assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'salon-assets'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

alter table public.customers
add column if not exists profile_image_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_profile_image_path_length_check'
  ) then
    alter table public.customers
    add constraint customers_profile_image_path_length_check
    check (
      profile_image_path is null
      or char_length(btrim(profile_image_path)) between 8 and 255
    );
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-profiles',
  'customer-profiles',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "customers_read_own_profile_images" on storage.objects;
drop policy if exists "customers_upload_own_profile_images" on storage.objects;
drop policy if exists "customers_update_own_profile_images" on storage.objects;
drop policy if exists "customers_delete_own_profile_images" on storage.objects;
drop policy if exists "owners_read_their_customer_profile_images" on storage.objects;

create policy "customers_read_own_profile_images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "customers_upload_own_profile_images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "customers_update_own_profile_images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
)
with check (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "customers_delete_own_profile_images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "owners_read_their_customer_profile_images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

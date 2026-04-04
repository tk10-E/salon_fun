alter table public.appointments
add column if not exists deposit_receipt_path text,
add column if not exists deposit_receipt_uploaded_at timestamptz,
add column if not exists deposit_receipt_content_type text;

alter table public.appointments
drop constraint if exists appointments_deposit_receipt_path_length_check,
drop constraint if exists appointments_deposit_receipt_content_type_length_check;

alter table public.appointments
add constraint appointments_deposit_receipt_path_length_check
check (
  deposit_receipt_path is null
  or char_length(btrim(deposit_receipt_path)) between 10 and 500
),
add constraint appointments_deposit_receipt_content_type_length_check
check (
  deposit_receipt_content_type is null
  or char_length(btrim(deposit_receipt_content_type)) between 3 and 100
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appointment-deposit-proofs',
  'appointment-deposit-proofs',
  false,
  6291456,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "customers_read_own_deposit_receipts" on storage.objects;
drop policy if exists "customers_upload_own_deposit_receipts" on storage.objects;
drop policy if exists "customers_update_own_deposit_receipts" on storage.objects;
drop policy if exists "customers_delete_own_deposit_receipts" on storage.objects;
drop policy if exists "owners_read_their_salon_deposit_receipts" on storage.objects;

create policy "customers_read_own_deposit_receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'appointment-deposit-proofs'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "customers_upload_own_deposit_receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'appointment-deposit-proofs'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "customers_update_own_deposit_receipts"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'appointment-deposit-proofs'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
)
with check (
  bucket_id = 'appointment-deposit-proofs'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "customers_delete_own_deposit_receipts"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'appointment-deposit-proofs'
  and (storage.foldername(name))[1] = public.current_customer_salon_id()::text
  and (storage.foldername(name))[2] = public.current_customer_id()::text
);

create policy "owners_read_their_salon_deposit_receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'appointment-deposit-proofs'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create or replace function public.attach_appointment_deposit_receipt(
  appointment_uuid uuid,
  receipt_path_input text,
  receipt_content_type_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  target_appointment public.appointments;
  updated_appointment public.appointments;
  expected_prefix text;
  normalized_receipt_path text := nullif(
    left(btrim(coalesce(receipt_path_input, '')), 500),
    ''
  );
  normalized_receipt_content_type text := nullif(
    left(btrim(lower(coalesce(receipt_content_type_input, ''))), 100),
    ''
  );
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid();

  if customer_profile.id is null then
    raise exception 'customer_not_linked';
  end if;

  if normalized_receipt_path is null then
    raise exception 'invalid_receipt_path';
  end if;

  select *
  into target_appointment
  from public.appointments
  where id = appointment_uuid;

  if target_appointment.id is null then
    raise exception 'appointment_not_found';
  end if;

  if target_appointment.customer_id <> customer_profile.id then
    raise exception 'unauthorized';
  end if;

  if target_appointment.status::text not in ('pending', 'confirmed') then
    raise exception 'appointment_not_collectable';
  end if;

  if target_appointment.date <= timezone('utc', now()) then
    raise exception 'appointment_already_started';
  end if;

  if coalesce(target_appointment.deposit_amount, 0) <= 0 then
    raise exception 'deposit_not_required';
  end if;

  expected_prefix :=
    customer_profile.salon_id::text
    || '/'
    || customer_profile.id::text
    || '/'
    || target_appointment.id::text
    || '/';

  if position(expected_prefix in normalized_receipt_path) <> 1 then
    raise exception 'invalid_receipt_path';
  end if;

  if normalized_receipt_content_type is not null
    and normalized_receipt_content_type not like 'image/%' then
    raise exception 'invalid_receipt_content_type';
  end if;

  update public.appointments
  set
    deposit_receipt_path = normalized_receipt_path,
    deposit_receipt_uploaded_at = timezone('utc', now()),
    deposit_receipt_content_type = normalized_receipt_content_type
  where id = target_appointment.id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

grant execute on function public.attach_appointment_deposit_receipt(uuid, text, text)
to authenticated;

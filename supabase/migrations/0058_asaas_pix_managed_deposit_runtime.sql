alter table public.salons
add column if not exists booking_policy_asaas_environment text not null default 'sandbox',
add column if not exists booking_policy_asaas_api_key text,
add column if not exists booking_policy_asaas_webhook_token text;

alter table public.customers
add column if not exists asaas_customer_id text,
add column if not exists asaas_customer_synced_at timestamptz;

alter table public.appointments
add column if not exists deposit_payment_provider text,
add column if not exists deposit_payment_provider_charge_id text,
add column if not exists deposit_payment_provider_status text,
add column if not exists deposit_payment_provider_payload text,
add column if not exists deposit_payment_provider_invoice_url text,
add column if not exists deposit_payment_provider_last_synced_at timestamptz,
add column if not exists deposit_payment_provider_error text;

create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  error_detail text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

alter table public.asaas_webhook_events enable row level security;

create unique index if not exists asaas_webhook_events_event_id_idx
on public.asaas_webhook_events (event_id);

create index if not exists asaas_webhook_events_salon_received_idx
on public.asaas_webhook_events (salon_id, received_at desc);

create unique index if not exists salons_booking_policy_asaas_webhook_token_idx
on public.salons (booking_policy_asaas_webhook_token)
where booking_policy_asaas_webhook_token is not null;

create unique index if not exists customers_salon_asaas_customer_id_idx
on public.customers (salon_id, asaas_customer_id)
where asaas_customer_id is not null;

create unique index if not exists appointments_salon_deposit_provider_charge_id_idx
on public.appointments (salon_id, deposit_payment_provider_charge_id)
where deposit_payment_provider_charge_id is not null;

alter table public.salons
drop constraint if exists salons_booking_policy_payment_mode_check,
drop constraint if exists salons_booking_policy_asaas_environment_check,
drop constraint if exists salons_booking_policy_asaas_api_key_length_check,
drop constraint if exists salons_booking_policy_asaas_webhook_token_length_check;

alter table public.salons
add constraint salons_booking_policy_payment_mode_check
check (
  booking_policy_payment_mode in (
    'manual',
    'pix',
    'external_checkout',
    'asaas_pix'
  )
),
add constraint salons_booking_policy_asaas_environment_check
check (booking_policy_asaas_environment in ('sandbox', 'production')),
add constraint salons_booking_policy_asaas_api_key_length_check
check (
  booking_policy_asaas_api_key is null
  or char_length(btrim(booking_policy_asaas_api_key)) between 20 and 255
),
add constraint salons_booking_policy_asaas_webhook_token_length_check
check (
  booking_policy_asaas_webhook_token is null
  or char_length(btrim(booking_policy_asaas_webhook_token)) between 24 and 255
);

alter table public.customers
drop constraint if exists customers_asaas_customer_id_length_check;

alter table public.customers
add constraint customers_asaas_customer_id_length_check
check (
  asaas_customer_id is null
  or char_length(btrim(asaas_customer_id)) between 4 and 80
);

alter table public.appointments
drop constraint if exists appointments_deposit_customer_reported_paid_via_check,
drop constraint if exists appointments_deposit_payment_provider_check,
drop constraint if exists appointments_deposit_payment_provider_charge_id_length_check,
drop constraint if exists appointments_deposit_payment_provider_status_length_check,
drop constraint if exists appointments_deposit_payment_provider_payload_length_check,
drop constraint if exists appointments_deposit_payment_provider_invoice_url_length_check,
drop constraint if exists appointments_deposit_payment_provider_error_length_check;

alter table public.appointments
add constraint appointments_deposit_customer_reported_paid_via_check
check (
  deposit_customer_reported_paid_via is null
  or deposit_customer_reported_paid_via in (
    'manual',
    'pix',
    'external_checkout',
    'asaas_pix'
  )
),
add constraint appointments_deposit_payment_provider_check
check (
  deposit_payment_provider is null
  or deposit_payment_provider in ('asaas')
),
add constraint appointments_deposit_payment_provider_charge_id_length_check
check (
  deposit_payment_provider_charge_id is null
  or char_length(btrim(deposit_payment_provider_charge_id)) between 4 and 80
),
add constraint appointments_deposit_payment_provider_status_length_check
check (
  deposit_payment_provider_status is null
  or char_length(btrim(deposit_payment_provider_status)) between 3 and 60
),
add constraint appointments_deposit_payment_provider_payload_length_check
check (
  deposit_payment_provider_payload is null
  or char_length(btrim(deposit_payment_provider_payload)) between 20 and 4096
),
add constraint appointments_deposit_payment_provider_invoice_url_length_check
check (
  deposit_payment_provider_invoice_url is null
  or char_length(btrim(deposit_payment_provider_invoice_url)) between 12 and 500
),
add constraint appointments_deposit_payment_provider_error_length_check
check (
  deposit_payment_provider_error is null
  or char_length(btrim(deposit_payment_provider_error)) between 3 and 500
);

alter table public.asaas_webhook_events
drop constraint if exists asaas_webhook_events_processing_status_check,
drop constraint if exists asaas_webhook_events_event_id_length_check,
drop constraint if exists asaas_webhook_events_event_type_length_check,
drop constraint if exists asaas_webhook_events_error_detail_length_check;

alter table public.asaas_webhook_events
add constraint asaas_webhook_events_processing_status_check
check (processing_status in ('received', 'processed', 'ignored', 'failed')),
add constraint asaas_webhook_events_event_id_length_check
check (char_length(btrim(event_id)) between 8 and 120),
add constraint asaas_webhook_events_event_type_length_check
check (char_length(btrim(event_type)) between 8 and 80),
add constraint asaas_webhook_events_error_detail_length_check
check (
  error_detail is null
  or char_length(btrim(error_detail)) between 3 and 500
);

create or replace function public.report_appointment_deposit_paid(
  appointment_uuid uuid,
  payment_method_input text default null,
  payment_reference_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  target_appointment public.appointments;
  reported_appointment public.appointments;
  normalized_payment_method text := coalesce(
    nullif(btrim(lower(coalesce(payment_method_input, ''))), ''),
    'manual'
  );
  normalized_payment_reference text := nullif(
    left(btrim(coalesce(payment_reference_input, '')), 120),
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

  if normalized_payment_method not in ('manual', 'pix', 'external_checkout', 'asaas_pix') then
    raise exception 'invalid_payment_method';
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

  if target_appointment.deposit_status <> 'pending' then
    return target_appointment;
  end if;

  update public.appointments
  set
    deposit_customer_reported_paid_at = timezone('utc', now()),
    deposit_customer_reported_paid_via = normalized_payment_method,
    deposit_customer_reported_reference = normalized_payment_reference
  where id = target_appointment.id
  returning * into reported_appointment;

  return reported_appointment;
end;
$$;

grant execute on function public.report_appointment_deposit_paid(uuid, text, text)
to authenticated;

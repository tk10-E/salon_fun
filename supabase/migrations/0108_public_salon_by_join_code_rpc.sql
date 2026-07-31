drop function if exists public.get_public_salon_by_join_code(text);

create function public.get_public_salon_by_join_code(input_join_code text)
returns table (
  id uuid,
  salon_id uuid,
  name text,
  tagline text,
  whatsapp_phone text,
  brand_color text,
  business_segment text,
  logo_path text,
  booking_policy_enabled boolean,
  booking_policy_title text,
  booking_policy_summary text,
  booking_policy_payment_mode text,
  booking_policy_pix_key text,
  booking_policy_pix_recipient_name text,
  booking_policy_pix_recipient_city text,
  booking_policy_external_checkout_url text,
  booking_policy_requires_deposit boolean,
  booking_policy_deposit_amount numeric,
  booking_policy_payment_instructions text,
  client_app_config jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.id as salon_id,
    s.name,
    s.tagline,
    s.whatsapp_phone,
    s.brand_color,
    s.business_segment,
    s.logo_path,
    s.booking_policy_enabled,
    s.booking_policy_title,
    s.booking_policy_summary,
    s.booking_policy_payment_mode,
    s.booking_policy_pix_key,
    s.booking_policy_pix_recipient_name,
    s.booking_policy_pix_recipient_city,
    s.booking_policy_external_checkout_url,
    s.booking_policy_requires_deposit,
    s.booking_policy_deposit_amount,
    s.booking_policy_payment_instructions,
    s.client_app_config
  from public.salons s
  where s.join_code = upper(trim(input_join_code))
  limit 1;
$$;

grant execute on function public.get_public_salon_by_join_code(text) to anon;
grant execute on function public.get_public_salon_by_join_code(text) to authenticated;

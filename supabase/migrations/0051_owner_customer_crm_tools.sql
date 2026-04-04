alter table public.customers
add column if not exists crm_label text,
add column if not exists internal_notes text;

alter table public.customers
drop constraint if exists customers_crm_label_length_check;

alter table public.customers
add constraint customers_crm_label_length_check
check (crm_label is null or char_length(btrim(crm_label)) between 1 and 40);

create or replace function public.update_owner_customer_profile(
  customer_uuid uuid,
  phone_input text default null,
  preferences_input text default null,
  allergies_input text default null,
  beauty_products_input text default null,
  crm_label_input text default null,
  internal_notes_input text default null
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  updated_customer public.customers;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  update public.customers
  set
    phone = nullif(btrim(phone_input), ''),
    preferences = nullif(btrim(preferences_input), ''),
    allergies = nullif(btrim(allergies_input), ''),
    beauty_products = nullif(btrim(beauty_products_input), ''),
    crm_label = nullif(left(btrim(crm_label_input), 40), ''),
    internal_notes = nullif(left(btrim(internal_notes_input), 2000), '')
  where id = customer_uuid
    and salon_id = owner_salon_id
  returning *
  into updated_customer;

  if updated_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  return updated_customer;
end;
$$;

grant execute on function public.update_owner_customer_profile(uuid, text, text, text, text, text, text)
to authenticated;

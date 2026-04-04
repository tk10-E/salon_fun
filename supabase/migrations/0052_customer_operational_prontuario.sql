alter table public.customers
add column if not exists beauty_goals text,
add column if not exists contraindications text,
add column if not exists technical_notes text,
add column if not exists consent_status text not null default 'not_required',
add column if not exists last_assessment_at date;

alter table public.customers
drop constraint if exists customers_beauty_goals_length_check,
drop constraint if exists customers_contraindications_length_check,
drop constraint if exists customers_technical_notes_length_check,
drop constraint if exists customers_consent_status_check;

alter table public.customers
add constraint customers_beauty_goals_length_check
check (beauty_goals is null or char_length(btrim(beauty_goals)) between 1 and 800),
add constraint customers_contraindications_length_check
check (
  contraindications is null
  or char_length(btrim(contraindications)) between 1 and 800
),
add constraint customers_technical_notes_length_check
check (technical_notes is null or char_length(btrim(technical_notes)) between 1 and 1200),
add constraint customers_consent_status_check
check (consent_status in ('pending', 'signed', 'not_required'));

drop function if exists public.update_owner_customer_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.update_owner_customer_profile(
  customer_uuid uuid,
  phone_input text default null,
  preferences_input text default null,
  allergies_input text default null,
  beauty_products_input text default null,
  crm_label_input text default null,
  internal_notes_input text default null,
  beauty_goals_input text default null,
  contraindications_input text default null,
  technical_notes_input text default null,
  consent_status_input text default null,
  last_assessment_at_input date default null
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  updated_customer public.customers;
  normalized_consent_status text :=
    lower(btrim(coalesce(consent_status_input, '')));
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  if normalized_consent_status not in ('', 'pending', 'signed', 'not_required') then
    raise exception 'invalid_consent_status';
  end if;

  update public.customers
  set
    phone = nullif(btrim(phone_input), ''),
    preferences = nullif(btrim(preferences_input), ''),
    allergies = nullif(btrim(allergies_input), ''),
    beauty_products = nullif(btrim(beauty_products_input), ''),
    crm_label = nullif(left(btrim(crm_label_input), 40), ''),
    internal_notes = nullif(left(btrim(internal_notes_input), 2000), ''),
    beauty_goals = nullif(left(btrim(beauty_goals_input), 800), ''),
    contraindications = nullif(left(btrim(contraindications_input), 800), ''),
    technical_notes = nullif(left(btrim(technical_notes_input), 1200), ''),
    consent_status = case
      when normalized_consent_status = '' then 'not_required'
      else normalized_consent_status
    end,
    last_assessment_at = last_assessment_at_input
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

grant execute on function public.update_owner_customer_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date
)
to authenticated;

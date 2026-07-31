alter table public.customer_membership_requests
  add column if not exists preferred_start_at timestamptz,
  add column if not exists preferred_staff_member_id uuid references public.staff_members (id) on delete set null,
  add column if not exists preferred_staff_member_name_snapshot text;

drop function if exists public.request_customer_membership_package(uuid, text);

create or replace function public.request_customer_membership_package(
  offer_uuid uuid,
  notes_input text default null,
  preferred_start_at_input timestamptz default null,
  preferred_staff_member_uuid uuid default null
)
returns public.customer_membership_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_customer public.customers;
  offer_record public.salon_offers;
  inserted_request public.customer_membership_requests;
  normalized_notes text;
  normalized_preferred_start_at timestamptz;
  selected_staff public.staff_members;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into current_customer
  from public.customers
  where auth_user_id = auth.uid();

  if current_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select *
  into offer_record
  from public.salon_offers
  where id = offer_uuid
    and salon_id = current_customer.salon_id
    and is_active = true;

  if offer_record.id is null then
    raise exception 'offer_not_found';
  end if;

  if offer_record.kind <> 'membership' then
    raise exception 'offer_not_membership';
  end if;

  if offer_record.membership_service_id is null
    or offer_record.membership_sessions_included is null
    or offer_record.membership_validity_days is null
  then
    raise exception 'membership_offer_not_operational';
  end if;

  if offer_record.starts_on is not null
    and offer_record.starts_on > current_date
    and offer_record.membership_validity_days < 30
  then
    raise exception 'offer_not_available_yet';
  end if;

  if offer_record.ends_on is not null and offer_record.ends_on < current_date then
    raise exception 'offer_not_available';
  end if;

  if exists (
    select 1
    from public.customer_membership_requests request
    where request.customer_id = current_customer.id
      and request.offer_id = offer_record.id
      and request.status = 'pending'
  ) then
    raise exception 'membership_request_already_pending';
  end if;

  normalized_notes := nullif(btrim(notes_input), '');
  normalized_preferred_start_at := preferred_start_at_input;

  if normalized_preferred_start_at is not null
    or preferred_staff_member_uuid is not null
  then
    if normalized_preferred_start_at is null
      or preferred_staff_member_uuid is null
    then
      raise exception 'membership_request_preferred_slot_incomplete';
    end if;

    if normalized_preferred_start_at < timezone('utc', now()) - interval '5 minutes' then
      raise exception 'membership_request_slot_in_past';
    end if;

    select *
    into selected_staff
    from public.staff_members
    where id = preferred_staff_member_uuid
      and salon_id = current_customer.salon_id
      and is_active = true;

    if selected_staff.id is null then
      raise exception 'membership_request_staff_not_found';
    end if;
  end if;

  insert into public.customer_membership_requests (
    salon_id,
    customer_id,
    offer_id,
    offer_title_snapshot,
    price_snapshot,
    notes,
    status,
    preferred_start_at,
    preferred_staff_member_id,
    preferred_staff_member_name_snapshot
  )
  values (
    current_customer.salon_id,
    current_customer.id,
    offer_record.id,
    offer_record.title,
    offer_record.price,
    normalized_notes,
    'pending',
    normalized_preferred_start_at,
    selected_staff.id,
    selected_staff.name
  )
  returning * into inserted_request;

  return inserted_request;
end;
$$;

revoke all on function public.request_customer_membership_package(uuid, text, timestamptz, uuid) from public, anon;
grant execute on function public.request_customer_membership_package(uuid, text, timestamptz, uuid) to authenticated, service_role;

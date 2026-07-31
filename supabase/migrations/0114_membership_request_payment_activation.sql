alter table public.customer_membership_requests
  add column if not exists approved_starts_on date,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by_user_id uuid;

update public.customer_membership_requests request
set
  approved_starts_on = coalesce(request.approved_starts_on, membership.started_at),
  payment_confirmed_at = coalesce(request.payment_confirmed_at, request.decided_at),
  payment_confirmed_by_user_id = coalesce(
    request.payment_confirmed_by_user_id,
    request.decided_by_user_id
  )
from public.customer_memberships membership
where request.membership_id = membership.id
  and request.status = 'approved';

drop index if exists customer_membership_requests_pending_unique_idx;

create unique index if not exists customer_membership_requests_open_unique_idx
on public.customer_membership_requests (customer_id, offer_id)
where status = 'pending'
  or (status = 'approved' and membership_id is null);

do $$
declare
  state_constraint_name text;
begin
  select current_constraint.conname
  into state_constraint_name
  from pg_constraint current_constraint
  where current_constraint.conrelid = 'public.customer_membership_requests'::regclass
    and current_constraint.contype = 'c'
    and pg_get_constraintdef(current_constraint.oid) like '%status = ''pending''%'
    and pg_get_constraintdef(current_constraint.oid) like '%membership_id is null%'
    and pg_get_constraintdef(current_constraint.oid) like '%status in (''rejected'', ''cancelled'')%'
  limit 1;

  if state_constraint_name is not null then
    execute format(
      'alter table public.customer_membership_requests drop constraint %I',
      state_constraint_name
    );
  end if;
end;
$$;

alter table public.customer_membership_requests
  drop constraint if exists customer_membership_requests_state_check;

alter table public.customer_membership_requests
  add constraint customer_membership_requests_state_check
  check (
    (
      status = 'pending'
      and decided_at is null
      and membership_id is null
      and approved_starts_on is null
      and payment_confirmed_at is null
      and payment_confirmed_by_user_id is null
    )
    or (
      status = 'approved'
      and decided_at is not null
      and approved_starts_on is not null
      and (
        (
          membership_id is null
          and payment_confirmed_at is null
          and payment_confirmed_by_user_id is null
        )
        or (
          membership_id is not null
          and payment_confirmed_at is not null
          and payment_confirmed_by_user_id is not null
        )
      )
    )
    or (
      status in ('rejected', 'cancelled')
      and decided_at is not null
      and membership_id is null
      and approved_starts_on is null
      and payment_confirmed_at is null
      and payment_confirmed_by_user_id is null
    )
  );

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
      and (
        request.status = 'pending'
        or (request.status = 'approved' and request.membership_id is null)
      )
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

drop function if exists public.approve_customer_membership_request(uuid, date, text);

create function public.approve_customer_membership_request(
  request_uuid uuid,
  starts_on_input date default null,
  notes_input text default null
)
returns public.customer_membership_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  request_record public.customer_membership_requests;
  active_membership public.customer_memberships;
  effective_starts_on date;
  normalized_notes text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select *
  into request_record
  from public.customer_membership_requests
  where id = request_uuid
    and salon_id = owner_salon.id
  for update;

  if request_record.id is null then
    raise exception 'membership_request_not_found';
  end if;

  if request_record.status <> 'pending' then
    raise exception 'membership_request_not_pending';
  end if;

  effective_starts_on := coalesce(starts_on_input, current_date);

  select *
  into active_membership
  from public.customer_memberships membership
  where membership.customer_id = request_record.customer_id
    and membership.offer_id = request_record.offer_id
    and membership.status <> 'cancelled'
    and membership.expires_at >= effective_starts_on
    and membership.sessions_used < membership.sessions_included
  order by membership.expires_at desc, membership.created_at desc
  limit 1;

  if active_membership.id is not null
    and active_membership.expires_at >= effective_starts_on
  then
    effective_starts_on := active_membership.expires_at + 1;
  end if;

  normalized_notes := nullif(btrim(notes_input), '');

  update public.customer_membership_requests
  set
    status = 'approved',
    decided_at = timezone('utc', now()),
    decision_notes = normalized_notes,
    approved_starts_on = effective_starts_on,
    membership_id = null,
    decided_by_user_id = auth.uid(),
    payment_confirmed_at = null,
    payment_confirmed_by_user_id = null
  where id = request_record.id
  returning * into request_record;

  return request_record;
end;
$$;

revoke all on function public.approve_customer_membership_request(uuid, date, text) from public, anon;
grant execute on function public.approve_customer_membership_request(uuid, date, text) to authenticated, service_role;

drop function if exists public.mark_customer_membership_request_paid(uuid);

create function public.mark_customer_membership_request_paid(
  request_uuid uuid
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  request_record public.customer_membership_requests;
  inserted_membership public.customer_memberships;
  effective_starts_on date;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select *
  into request_record
  from public.customer_membership_requests
  where id = request_uuid
    and salon_id = owner_salon.id
  for update;

  if request_record.id is null then
    raise exception 'membership_request_not_found';
  end if;

  if request_record.status <> 'approved' then
    raise exception 'membership_request_not_approved';
  end if;

  if request_record.membership_id is not null then
    raise exception 'membership_request_already_paid';
  end if;

  effective_starts_on := coalesce(request_record.approved_starts_on, current_date);

  select public.assign_customer_membership_package(
    request_record.customer_id,
    request_record.offer_id,
    effective_starts_on,
    coalesce(request_record.decision_notes, request_record.notes)
  )
  into inserted_membership;

  update public.customer_membership_requests
  set
    membership_id = inserted_membership.id,
    payment_confirmed_at = timezone('utc', now()),
    payment_confirmed_by_user_id = auth.uid()
  where id = request_record.id;

  return inserted_membership;
end;
$$;

revoke all on function public.mark_customer_membership_request_paid(uuid) from public, anon;
grant execute on function public.mark_customer_membership_request_paid(uuid) to authenticated, service_role;

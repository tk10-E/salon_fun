create or replace function public.approve_customer_membership_request(
  request_uuid uuid,
  starts_on_input date default null,
  notes_input text default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  request_record public.customer_membership_requests;
  active_membership public.customer_memberships;
  inserted_membership public.customer_memberships;
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

  select *
  into inserted_membership
  from public.assign_customer_membership_package(
    request_record.customer_id,
    request_record.offer_id,
    effective_starts_on,
    coalesce(normalized_notes, request_record.notes)
  );

  update public.customer_membership_requests
  set
    status = 'approved',
    decided_at = timezone('utc', now()),
    decision_notes = normalized_notes,
    membership_id = inserted_membership.id,
    decided_by_user_id = auth.uid()
  where id = request_record.id;

  return inserted_membership;
end;
$$;

revoke all on function public.approve_customer_membership_request(uuid, date, text) from public, anon;
grant execute on function public.approve_customer_membership_request(uuid, date, text) to authenticated, service_role;

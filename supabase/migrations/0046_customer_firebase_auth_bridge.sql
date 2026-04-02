create or replace function public.link_customer_identity_by_email()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_auth_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_customer_id uuid;
  legacy_customer_id uuid;
begin
  if current_auth_user_id is null then
    raise exception 'authentication_required';
  end if;

  select customer.id
  into current_customer_id
  from public.customers customer
  where customer.auth_user_id = current_auth_user_id
  limit 1;

  if current_customer_id is not null then
    return current_customer_id;
  end if;

  if current_email = '' then
    return null;
  end if;

  select customer.id
  into legacy_customer_id
  from public.customers customer
  join auth.users legacy_auth_user
    on legacy_auth_user.id = customer.auth_user_id
  where lower(coalesce(legacy_auth_user.email, '')) = current_email
    and customer.auth_user_id <> current_auth_user_id
  order by customer.created_at asc
  limit 1;

  if legacy_customer_id is null then
    return null;
  end if;

  update public.customers
  set auth_user_id = current_auth_user_id
  where id = legacy_customer_id;

  update public.customer_push_tokens
  set auth_user_id = current_auth_user_id
  where customer_id = legacy_customer_id;

  return legacy_customer_id;
end;
$$;

grant execute on function public.link_customer_identity_by_email() to authenticated;

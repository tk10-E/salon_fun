create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.customers
  where auth_user_id = auth.uid()
  order by
    updated_at desc nulls last,
    created_at desc,
    id desc
  limit 1;
$$;

create or replace function public.current_customer_salon_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select salon_id
  from public.customers
  where auth_user_id = auth.uid()
  order by
    updated_at desc nulls last,
    created_at desc,
    id desc
  limit 1;
$$;

drop function if exists public.get_customer_birthday_home_experience();

create or replace function public.get_customer_birthday_home_experience()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  resolved_customer_id uuid := public.current_customer_id();
  current_customer public.customers;
  current_salon public.salons;
  current_local_date date := timezone('utc', now())::date;
  campaign public.salon_birthday_campaigns;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if resolved_customer_id is null then
    return null;
  end if;

  select *
  into current_customer
  from public.customers
  where id = resolved_customer_id
  limit 1;

  if current_customer.id is null then
    return null;
  end if;

  select *
  into current_salon
  from public.salons
  where id = current_customer.salon_id
  limit 1;

  if current_salon.id is null then
    return null;
  end if;

  current_local_date := (
    timezone('utc', now())
    at time zone coalesce(current_salon.timezone, 'America/Sao_Paulo')
  )::date;

  if current_customer.birth_date is null then
    return null;
  end if;

  if extract(month from current_customer.birth_date) <>
    extract(month from current_local_date)
    or extract(day from current_customer.birth_date) <>
      extract(day from current_local_date) then
    return null;
  end if;

  select *
  into campaign
  from public.salon_birthday_campaigns
  where salon_id = current_customer.salon_id
    and is_active is true
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if campaign.id is null then
    return null;
  end if;

  if nullif(btrim(campaign.message), '') is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', campaign.id,
    'title', coalesce(nullif(btrim(campaign.title), ''), 'Feliz aniversario!'),
    'message', campaign.message,
    'mediaKind', campaign.media_kind,
    'imagePath', campaign.image_path,
    'videoPath', campaign.video_path,
    'customerName', current_customer.name,
    'birthDate', current_customer.birth_date,
    'salonName', current_salon.name
  );
end;
$$;

grant execute on function public.get_customer_birthday_home_experience()
to authenticated;

create table if not exists public.salon_birthday_campaigns (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  is_active boolean not null default true,
  title text not null default 'Feliz aniversario!',
  message text not null default '',
  media_kind text null,
  image_path text null,
  video_path text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salon_birthday_campaigns_salon_id_key unique (salon_id),
  constraint salon_birthday_campaigns_media_kind_check check (
    media_kind is null
    or media_kind in ('image', 'video')
  ),
  constraint salon_birthday_campaigns_media_path_check check (
    (media_kind is null and image_path is null and video_path is null)
    or (media_kind = 'image' and image_path is not null and video_path is null)
    or (media_kind = 'video' and video_path is not null and image_path is null)
  )
);

create index if not exists salon_birthday_campaigns_active_idx
on public.salon_birthday_campaigns (salon_id, is_active);

alter table public.salon_birthday_campaigns enable row level security;

drop policy if exists "owners_manage_salon_birthday_campaigns"
on public.salon_birthday_campaigns;

create policy "owners_manage_salon_birthday_campaigns"
on public.salon_birthday_campaigns
for all
using (salon_id = public.current_owner_salon_id())
with check (salon_id = public.current_owner_salon_id());

create or replace function public.touch_salon_birthday_campaign_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_birthday_campaigns_touch_updated_at
on public.salon_birthday_campaigns;

create trigger salon_birthday_campaigns_touch_updated_at
before update on public.salon_birthday_campaigns
for each row
execute function public.touch_salon_birthday_campaign_updated_at();

drop function if exists public.get_customer_birthday_home_experience();

create or replace function public.get_customer_birthday_home_experience()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  current_customer public.customers;
  current_salon public.salons;
  current_local_date date := timezone('utc', now())::date;
  campaign public.salon_birthday_campaigns;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into current_customer
  from public.customers
  where auth_user_id = auth.uid()
  order by updated_at desc nulls last, created_at desc
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

alter table public.salon_posts
add column if not exists service_id uuid references public.services (id) on delete set null;

create table if not exists public.salon_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.salon_posts (id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists salon_post_images_post_id_idx
on public.salon_post_images (post_id, sort_order asc, created_at asc);

create or replace function public.validate_salon_post_service()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_service_salon_id uuid;
begin
  if new.service_id is null then
    return new;
  end if;

  select salon_id into linked_service_salon_id
  from public.services
  where id = new.service_id;

  if linked_service_salon_id is null then
    raise exception 'invalid_post_service';
  end if;

  if linked_service_salon_id <> new.salon_id then
    raise exception 'post_service_must_belong_to_same_salon';
  end if;

  return new;
end;
$$;

drop trigger if exists salon_posts_validate_service on public.salon_posts;

create trigger salon_posts_validate_service
before insert or update of salon_id, service_id
on public.salon_posts
for each row
execute function public.validate_salon_post_service();

insert into public.salon_post_images (post_id, image_path, sort_order)
select salon_posts.id, salon_posts.image_path, 0
from public.salon_posts
where salon_posts.image_path is not null
  and not exists (
    select 1
    from public.salon_post_images
    where salon_post_images.post_id = salon_posts.id
      and salon_post_images.image_path = salon_posts.image_path
  );

alter table public.salon_post_images enable row level security;

drop policy if exists "owners_manage_salon_post_images" on public.salon_post_images;
drop policy if exists "customers_read_salon_post_images" on public.salon_post_images;

create policy "owners_manage_salon_post_images"
on public.salon_post_images
for all
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_images.post_id
      and public.is_owner_of_salon(salon_posts.salon_id)
  )
)
with check (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_images.post_id
      and public.is_owner_of_salon(salon_posts.salon_id)
  )
);

create policy "customers_read_salon_post_images"
on public.salon_post_images
for select
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_images.post_id
      and public.is_customer_of_salon(salon_posts.salon_id)
  )
);

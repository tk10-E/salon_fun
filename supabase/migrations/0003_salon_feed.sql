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
  limit 1;
$$;

create table if not exists public.salon_posts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  title text not null,
  caption text,
  image_path text not null,
  created_by_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(title)) > 0),
  check (caption is null or char_length(btrim(caption)) <= 500)
);

create table if not exists public.salon_post_likes (
  post_id uuid not null references public.salon_posts (id) on delete cascade,
  customer_id uuid not null default public.current_customer_id() references public.customers (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, customer_id)
);

create table if not exists public.salon_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.salon_posts (id) on delete cascade,
  customer_id uuid not null default public.current_customer_id() references public.customers (id) on delete cascade,
  customer_name text not null default '',
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(body)) > 0),
  check (char_length(body) <= 500)
);

create index if not exists salon_posts_salon_id_idx
on public.salon_posts (salon_id, created_at desc);

create index if not exists salon_post_likes_post_id_idx
on public.salon_post_likes (post_id);

create index if not exists salon_post_comments_post_id_idx
on public.salon_post_comments (post_id, created_at desc);

create or replace function public.sync_salon_post_comment_author()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  author_id uuid;
  author_name text;
begin
  author_id := coalesce(new.customer_id, public.current_customer_id());

  if author_id is null then
    raise exception 'customer_not_found';
  end if;

  select name into author_name
  from public.customers
  where id = author_id;

  if author_name is null then
    raise exception 'customer_not_found';
  end if;

  new.customer_id := author_id;
  new.customer_name := author_name;
  new.body := btrim(new.body);
  return new;
end;
$$;

drop trigger if exists salon_post_comments_sync_author on public.salon_post_comments;

create trigger salon_post_comments_sync_author
before insert or update of customer_id, body
on public.salon_post_comments
for each row
execute function public.sync_salon_post_comment_author();

alter table public.salon_posts enable row level security;
alter table public.salon_post_likes enable row level security;
alter table public.salon_post_comments enable row level security;

drop policy if exists "owners_manage_salon_posts" on public.salon_posts;
drop policy if exists "customers_read_salon_posts" on public.salon_posts;
drop policy if exists "owners_read_salon_post_likes" on public.salon_post_likes;
drop policy if exists "customers_read_salon_post_likes" on public.salon_post_likes;
drop policy if exists "customers_manage_own_salon_post_likes" on public.salon_post_likes;
drop policy if exists "owners_read_salon_post_comments" on public.salon_post_comments;
drop policy if exists "customers_read_salon_post_comments" on public.salon_post_comments;
drop policy if exists "customers_insert_salon_post_comments" on public.salon_post_comments;
drop policy if exists "customers_delete_own_salon_post_comments" on public.salon_post_comments;
drop policy if exists "owners_delete_salon_post_comments" on public.salon_post_comments;

create policy "owners_manage_salon_posts"
on public.salon_posts
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_salon_posts"
on public.salon_posts
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

create policy "owners_read_salon_post_likes"
on public.salon_post_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_likes.post_id
      and public.is_owner_of_salon(salon_posts.salon_id)
  )
);

create policy "customers_read_salon_post_likes"
on public.salon_post_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_likes.post_id
      and public.is_customer_of_salon(salon_posts.salon_id)
  )
);

create policy "customers_manage_own_salon_post_likes"
on public.salon_post_likes
for all
to authenticated
using (customer_id = public.current_customer_id())
with check (
  customer_id = public.current_customer_id()
  and exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_likes.post_id
      and public.is_customer_of_salon(salon_posts.salon_id)
  )
);

create policy "owners_read_salon_post_comments"
on public.salon_post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_comments.post_id
      and public.is_owner_of_salon(salon_posts.salon_id)
  )
);

create policy "customers_read_salon_post_comments"
on public.salon_post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_comments.post_id
      and public.is_customer_of_salon(salon_posts.salon_id)
  )
);

create policy "customers_insert_salon_post_comments"
on public.salon_post_comments
for insert
to authenticated
with check (
  customer_id = public.current_customer_id()
  and exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_comments.post_id
      and public.is_customer_of_salon(salon_posts.salon_id)
  )
);

create policy "customers_delete_own_salon_post_comments"
on public.salon_post_comments
for delete
to authenticated
using (customer_id = public.current_customer_id());

create policy "owners_delete_salon_post_comments"
on public.salon_post_comments
for delete
to authenticated
using (
  exists (
    select 1
    from public.salon_posts
    where salon_posts.id = salon_post_comments.post_id
      and public.is_owner_of_salon(salon_posts.salon_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salon-posts',
  'salon-posts',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owners_read_their_salon_posts_media" on storage.objects;
drop policy if exists "owners_upload_their_salon_posts_media" on storage.objects;
drop policy if exists "owners_update_their_salon_posts_media" on storage.objects;
drop policy if exists "owners_delete_their_salon_posts_media" on storage.objects;

create policy "owners_read_their_salon_posts_media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'salon-posts'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_upload_their_salon_posts_media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'salon-posts'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_update_their_salon_posts_media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'salon-posts'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
)
with check (
  bucket_id = 'salon-posts'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create policy "owners_delete_their_salon_posts_media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'salon-posts'
  and (storage.foldername(name))[1] = public.current_owner_salon_id()::text
);

create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references public.salons (id) on delete cascade,
  instagram_user_id text not null unique,
  instagram_username text not null,
  facebook_page_id text,
  access_token_ciphertext text not null,
  connection_status text not null default 'active',
  auto_publish_owned_posts boolean not null default false,
  require_mention_approval boolean not null default true,
  import_story_mentions boolean not null default true,
  last_webhook_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(instagram_user_id)) > 0),
  check (char_length(btrim(instagram_username)) > 0),
  check (connection_status in ('active', 'inactive', 'error'))
);

create table if not exists public.instagram_webhook_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  instagram_connection_id uuid references public.instagram_connections (id) on delete set null,
  event_key text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  check (char_length(btrim(event_key)) > 0),
  check (char_length(btrim(event_type)) > 0),
  check (processing_status in ('received', 'processed', 'ignored', 'failed'))
);

create table if not exists public.instagram_mentions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  instagram_connection_id uuid references public.instagram_connections (id) on delete set null,
  dedupe_key text not null unique,
  external_media_id text,
  source_type text not null default 'post_mention',
  media_type text not null default 'unknown',
  author_username text,
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  mentioned_at timestamptz,
  moderation_status text not null default 'pending',
  moderation_note text,
  approved_by_user_id uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  published_post_id uuid,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(dedupe_key)) > 0),
  check (
    source_type in (
      'post_mention',
      'story_mention',
      'owned_post',
      'comment_mention'
    )
  ),
  check (
    media_type in (
      'image',
      'video',
      'carousel',
      'story',
      'unknown'
    )
  ),
  check (
    moderation_status in (
      'pending',
      'approved',
      'rejected',
      'published'
    )
  ),
  check (
    caption is null
    or char_length(caption) <= 4000
  )
);

create index if not exists instagram_webhook_events_salon_idx
on public.instagram_webhook_events (salon_id, created_at desc);

create index if not exists instagram_webhook_events_status_idx
on public.instagram_webhook_events (processing_status, created_at desc);

create index if not exists instagram_mentions_salon_status_idx
on public.instagram_mentions (salon_id, moderation_status, mentioned_at desc, created_at desc);

create index if not exists instagram_mentions_source_idx
on public.instagram_mentions (salon_id, source_type, created_at desc);

create unique index if not exists instagram_mentions_external_media_id_idx
on public.instagram_mentions (salon_id, external_media_id)
where external_media_id is not null;

create or replace function public.touch_instagram_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.touch_instagram_mentions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists instagram_connections_touch_updated_at on public.instagram_connections;
create trigger instagram_connections_touch_updated_at
before update on public.instagram_connections
for each row
execute function public.touch_instagram_connections_updated_at();

drop trigger if exists instagram_mentions_touch_updated_at on public.instagram_mentions;
create trigger instagram_mentions_touch_updated_at
before update on public.instagram_mentions
for each row
execute function public.touch_instagram_mentions_updated_at();

alter table public.salon_posts
add column if not exists source_type text not null default 'native',
add column if not exists instagram_mention_id uuid,
add column if not exists external_permalink text,
add column if not exists external_author_username text,
add column if not exists external_media_url text,
add column if not exists external_thumbnail_url text;

alter table public.salon_posts
drop constraint if exists salon_posts_source_type_check;

alter table public.salon_posts
add constraint salon_posts_source_type_check
check (source_type in ('native', 'instagram_mention', 'instagram_owned_post'));

alter table public.salon_posts
drop constraint if exists salon_posts_instagram_mention_id_fkey;

alter table public.salon_posts
add constraint salon_posts_instagram_mention_id_fkey
foreign key (instagram_mention_id)
references public.instagram_mentions (id)
on delete set null;

alter table public.instagram_mentions
drop constraint if exists instagram_mentions_published_post_id_fkey;

alter table public.instagram_mentions
add constraint instagram_mentions_published_post_id_fkey
foreign key (published_post_id)
references public.salon_posts (id)
on delete set null;

create unique index if not exists salon_posts_instagram_mention_id_idx
on public.salon_posts (instagram_mention_id)
where instagram_mention_id is not null;

create or replace function public.validate_salon_post_relations()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_service_salon_id uuid;
  linked_staff_salon_id uuid;
  linked_instagram_mention_salon_id uuid;
begin
  if new.post_type not in ('standard', 'before_after', 'reel') then
    raise exception 'invalid_post_type';
  end if;

  if new.source_type not in ('native', 'instagram_mention', 'instagram_owned_post') then
    raise exception 'invalid_post_source_type';
  end if;

  if new.service_id is not null then
    select salon_id into linked_service_salon_id
    from public.services
    where id = new.service_id;

    if linked_service_salon_id is null then
      raise exception 'invalid_post_service';
    end if;

    if linked_service_salon_id <> new.salon_id then
      raise exception 'post_service_must_belong_to_same_salon';
    end if;
  end if;

  if new.staff_member_id is not null then
    select salon_id into linked_staff_salon_id
    from public.staff_members
    where id = new.staff_member_id;

    if linked_staff_salon_id is null then
      raise exception 'invalid_post_staff_member';
    end if;

    if linked_staff_salon_id <> new.salon_id then
      raise exception 'post_staff_member_must_belong_to_same_salon';
    end if;
  end if;

  if new.instagram_mention_id is not null then
    select salon_id into linked_instagram_mention_salon_id
    from public.instagram_mentions
    where id = new.instagram_mention_id;

    if linked_instagram_mention_salon_id is null then
      raise exception 'invalid_instagram_mention';
    end if;

    if linked_instagram_mention_salon_id <> new.salon_id then
      raise exception 'instagram_mention_must_belong_to_same_salon';
    end if;
  end if;

  if new.source_type = 'instagram_mention' and new.instagram_mention_id is null then
    raise exception 'instagram_mention_source_requires_reference';
  end if;

  if new.source_type = 'native' and new.instagram_mention_id is not null then
    raise exception 'native_post_cannot_reference_instagram_mention';
  end if;

  if new.post_type = 'reel' and coalesce(nullif(btrim(new.video_path), ''), null) is null then
    raise exception 'reel_requires_video';
  end if;

  if new.post_type <> 'reel' and coalesce(nullif(btrim(new.video_path), ''), null) is not null then
    raise exception 'only_reels_can_have_video';
  end if;

  return new;
end;
$$;

alter table public.instagram_connections enable row level security;
alter table public.instagram_webhook_events enable row level security;
alter table public.instagram_mentions enable row level security;

drop policy if exists "owners_manage_instagram_connections" on public.instagram_connections;
create policy "owners_manage_instagram_connections"
on public.instagram_connections
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_read_instagram_webhook_events" on public.instagram_webhook_events;
create policy "owners_read_instagram_webhook_events"
on public.instagram_webhook_events
for select
to authenticated
using (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_instagram_mentions" on public.instagram_mentions;
create policy "owners_manage_instagram_mentions"
on public.instagram_mentions
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

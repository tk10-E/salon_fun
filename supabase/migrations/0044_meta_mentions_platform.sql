alter table public.instagram_connections
add column if not exists facebook_page_name text,
add column if not exists facebook_page_access_token_ciphertext text;

create unique index if not exists instagram_connections_facebook_page_id_idx
on public.instagram_connections (facebook_page_id)
where facebook_page_id is not null;

alter table public.instagram_mentions
add column if not exists platform text not null default 'instagram';

alter table public.instagram_mentions
drop constraint if exists instagram_mentions_platform_check;

alter table public.instagram_mentions
add constraint instagram_mentions_platform_check
check (platform in ('instagram', 'facebook'));

update public.instagram_mentions
set platform = 'instagram'
where platform is null;

drop index if exists instagram_mentions_external_media_id_idx;

create unique index if not exists instagram_mentions_external_media_id_idx
on public.instagram_mentions (salon_id, platform, external_media_id)
where external_media_id is not null;

alter table public.salon_posts
add column if not exists external_platform text;

alter table public.salon_posts
drop constraint if exists salon_posts_external_platform_check;

alter table public.salon_posts
add constraint salon_posts_external_platform_check
check (
  external_platform is null
  or external_platform in ('instagram', 'facebook')
);

update public.salon_posts
set external_platform = 'instagram'
where external_platform is null
  and source_type in ('instagram_mention', 'instagram_owned_post');

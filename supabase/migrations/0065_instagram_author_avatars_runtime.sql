alter table public.instagram_connections
add column if not exists profile_picture_url text;

alter table public.instagram_mentions
add column if not exists author_profile_picture_url text;

alter table public.salon_posts
add column if not exists external_author_avatar_url text;

update public.instagram_mentions mention
set author_profile_picture_url = connection.profile_picture_url
from public.instagram_connections connection
where mention.instagram_connection_id = connection.id
  and mention.source_type = 'owned_post'
  and coalesce(nullif(btrim(connection.profile_picture_url), ''), null) is not null
  and coalesce(nullif(btrim(mention.author_profile_picture_url), ''), null) is null;

update public.salon_posts post
set external_author_avatar_url = mention.author_profile_picture_url
from public.instagram_mentions mention
where post.instagram_mention_id = mention.id
  and coalesce(nullif(btrim(mention.author_profile_picture_url), ''), null) is not null
  and coalesce(nullif(btrim(post.external_author_avatar_url), ''), null) is null;

update public.salon_posts post
set external_author_avatar_url = connection.profile_picture_url
from public.instagram_connections connection
where post.salon_id = connection.salon_id
  and post.source_type = 'instagram_owned_post'
  and coalesce(nullif(btrim(connection.profile_picture_url), ''), null) is not null
  and coalesce(nullif(btrim(post.external_author_avatar_url), ''), null) is null;

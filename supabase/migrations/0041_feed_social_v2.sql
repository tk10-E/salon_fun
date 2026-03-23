alter table public.salon_posts
add column if not exists post_type text not null default 'standard',
add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null,
add column if not exists video_path text;

alter table public.salon_posts
drop constraint if exists salon_posts_post_type_check;

alter table public.salon_posts
add constraint salon_posts_post_type_check
check (post_type in ('standard', 'before_after', 'reel'));

create index if not exists salon_posts_post_type_idx
on public.salon_posts (salon_id, post_type, created_at desc);

create index if not exists salon_posts_staff_member_idx
on public.salon_posts (salon_id, staff_member_id, created_at desc);

create or replace function public.validate_salon_post_relations()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_service_salon_id uuid;
  linked_staff_salon_id uuid;
begin
  if new.post_type not in ('standard', 'before_after', 'reel') then
    raise exception 'invalid_post_type';
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

  if new.post_type = 'reel' and coalesce(nullif(btrim(new.video_path), ''), null) is null then
    raise exception 'reel_requires_video';
  end if;

  if new.post_type <> 'reel' and coalesce(nullif(btrim(new.video_path), ''), null) is not null then
    raise exception 'only_reels_can_have_video';
  end if;

  return new;
end;
$$;

drop trigger if exists salon_posts_validate_service on public.salon_posts;
drop trigger if exists salon_posts_validate_relations on public.salon_posts;

create trigger salon_posts_validate_relations
before insert or update of salon_id, service_id, staff_member_id, post_type, video_path
on public.salon_posts
for each row
execute function public.validate_salon_post_relations();

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]
where id = 'salon-posts';

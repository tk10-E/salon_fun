create table if not exists public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  rating smallint not null,
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint appointment_reviews_rating_check check (rating between 1 and 5),
  constraint appointment_reviews_comment_check check (
    comment is null
    or char_length(btrim(comment)) between 1 and 600
  ),
  constraint appointment_reviews_appointment_uidx unique (appointment_id)
);

create index if not exists appointment_reviews_salon_staff_idx
on public.appointment_reviews (salon_id, staff_member_id, created_at desc);

create index if not exists appointment_reviews_customer_idx
on public.appointment_reviews (customer_id, created_at desc);

drop trigger if exists appointment_reviews_touch_management_updated_at
on public.appointment_reviews;

create trigger appointment_reviews_touch_management_updated_at
before update on public.appointment_reviews
for each row
execute function public.touch_management_updated_at();

alter table public.appointment_reviews enable row level security;

drop policy if exists "owners_read_appointment_reviews"
on public.appointment_reviews;

drop policy if exists "customers_read_their_appointment_reviews"
on public.appointment_reviews;

create policy "owners_read_appointment_reviews"
on public.appointment_reviews
for select
to authenticated
using (public.is_owner_of_salon(salon_id));

create policy "customers_read_their_appointment_reviews"
on public.appointment_reviews
for select
to authenticated
using (customer_id = public.current_customer_id());

create or replace function public.submit_appointment_review(
  appointment_uuid uuid,
  rating_input integer,
  comment_input text default null
)
returns public.appointment_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_customer_id uuid := public.current_customer_id();
  authenticated_salon_id uuid := public.current_customer_salon_id();
  normalized_comment text := nullif(btrim(comment_input), '');
  target_appointment public.appointments;
  persisted_review public.appointment_reviews;
begin
  if auth.uid() is null or authenticated_customer_id is null then
    raise exception 'unauthenticated';
  end if;

  if rating_input is null or rating_input < 1 or rating_input > 5 then
    raise exception 'invalid_review_rating';
  end if;

  if normalized_comment is not null and char_length(normalized_comment) > 600 then
    raise exception 'review_comment_too_long';
  end if;

  select appointment.*
  into target_appointment
  from public.appointments as appointment
  where appointment.id = appointment_uuid
    and appointment.customer_id = authenticated_customer_id
    and appointment.salon_id = authenticated_salon_id
    and appointment.status = 'completed';

  if target_appointment.id is null then
    raise exception 'appointment_review_not_allowed';
  end if;

  if target_appointment.staff_member_id is null then
    raise exception 'appointment_review_staff_required';
  end if;

  insert into public.appointment_reviews (
    salon_id,
    appointment_id,
    customer_id,
    staff_member_id,
    service_id,
    rating,
    comment
  )
  values (
    target_appointment.salon_id,
    target_appointment.id,
    authenticated_customer_id,
    target_appointment.staff_member_id,
    target_appointment.service_id,
    rating_input,
    normalized_comment
  )
  on conflict (appointment_id)
  do update
  set
    rating = excluded.rating,
    comment = excluded.comment,
    updated_at = timezone('utc', now())
  where public.appointment_reviews.customer_id = authenticated_customer_id
  returning * into persisted_review;

  return persisted_review;
end;
$$;

grant execute on function public.submit_appointment_review(uuid, integer, text)
to authenticated;

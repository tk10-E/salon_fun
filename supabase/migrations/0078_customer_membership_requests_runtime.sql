create table if not exists public.customer_membership_requests (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  offer_id uuid not null references public.salon_offers (id) on delete cascade,
  offer_title_snapshot text not null,
  price_snapshot numeric(10, 2) check (price_snapshot is null or price_snapshot >= 0),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz,
  decision_notes text,
  membership_id uuid references public.customer_memberships (id) on delete set null,
  decided_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(offer_title_snapshot)) between 1 and 120),
  check (notes is null or char_length(btrim(notes)) between 1 and 1000),
  check (decision_notes is null or char_length(btrim(decision_notes)) between 1 and 1000),
  check (
    (status = 'pending' and decided_at is null and membership_id is null)
    or (status = 'approved' and decided_at is not null and membership_id is not null)
    or (status in ('rejected', 'cancelled') and decided_at is not null)
  )
);

create index if not exists customer_membership_requests_salon_status_idx
on public.customer_membership_requests (salon_id, status, requested_at desc);

create index if not exists customer_membership_requests_customer_status_idx
on public.customer_membership_requests (customer_id, status, requested_at desc);

create unique index if not exists customer_membership_requests_pending_unique_idx
on public.customer_membership_requests (customer_id, offer_id)
where status = 'pending';

create or replace function public.touch_customer_membership_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_membership_requests_touch_updated_at on public.customer_membership_requests;

create trigger customer_membership_requests_touch_updated_at
before update on public.customer_membership_requests
for each row
execute function public.touch_customer_membership_request_updated_at();

alter table public.customer_membership_requests enable row level security;

drop policy if exists "owners_manage_customer_membership_requests" on public.customer_membership_requests;
drop policy if exists "customers_read_own_membership_requests" on public.customer_membership_requests;

create policy "owners_manage_customer_membership_requests"
on public.customer_membership_requests
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_membership_requests"
on public.customer_membership_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.customers customer
    where customer.id = customer_id
      and customer.auth_user_id = auth.uid()
  )
);

create or replace function public.request_customer_membership_package(
  offer_uuid uuid,
  notes_input text default null
)
returns public.customer_membership_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_customer public.customers;
  offer_record public.salon_offers;
  inserted_request public.customer_membership_requests;
  normalized_notes text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into current_customer
  from public.customers
  where auth_user_id = auth.uid();

  if current_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select *
  into offer_record
  from public.salon_offers
  where id = offer_uuid
    and salon_id = current_customer.salon_id
    and is_active = true;

  if offer_record.id is null then
    raise exception 'offer_not_found';
  end if;

  if offer_record.kind <> 'membership' then
    raise exception 'offer_not_membership';
  end if;

  if offer_record.membership_service_id is null
    or offer_record.membership_sessions_included is null
    or offer_record.membership_validity_days is null
  then
    raise exception 'membership_offer_not_operational';
  end if;

  if offer_record.starts_on is not null and offer_record.starts_on > current_date then
    raise exception 'offer_not_available_yet';
  end if;

  if offer_record.ends_on is not null and offer_record.ends_on < current_date then
    raise exception 'offer_not_available';
  end if;

  if exists (
    select 1
    from public.customer_membership_requests request
    where request.customer_id = current_customer.id
      and request.offer_id = offer_record.id
      and request.status = 'pending'
  ) then
    raise exception 'membership_request_already_pending';
  end if;

  normalized_notes := nullif(btrim(notes_input), '');

  insert into public.customer_membership_requests (
    salon_id,
    customer_id,
    offer_id,
    offer_title_snapshot,
    price_snapshot,
    notes,
    status
  )
  values (
    current_customer.salon_id,
    current_customer.id,
    offer_record.id,
    offer_record.title,
    offer_record.price,
    normalized_notes,
    'pending'
  )
  returning * into inserted_request;

  return inserted_request;
end;
$$;

revoke all on function public.request_customer_membership_package(uuid, text) from public, anon;
grant execute on function public.request_customer_membership_package(uuid, text) to authenticated, service_role;

create or replace function public.approve_customer_membership_request(
  request_uuid uuid,
  starts_on_input date default null,
  notes_input text default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  request_record public.customer_membership_requests;
  active_membership public.customer_memberships;
  inserted_membership public.customer_memberships;
  effective_starts_on date;
  normalized_notes text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select *
  into request_record
  from public.customer_membership_requests
  where id = request_uuid
    and salon_id = owner_salon.id
  for update;

  if request_record.id is null then
    raise exception 'membership_request_not_found';
  end if;

  if request_record.status <> 'pending' then
    raise exception 'membership_request_not_pending';
  end if;

  effective_starts_on := coalesce(starts_on_input, current_date);

  select *
  into active_membership
  from public.customer_memberships membership
  where membership.customer_id = request_record.customer_id
    and membership.offer_id = request_record.offer_id
    and membership.status <> 'cancelled'
    and membership.expires_at >= effective_starts_on
    and membership.sessions_used < membership.sessions_included
  order by membership.expires_at desc, membership.created_at desc
  limit 1;

  if active_membership.id is not null and active_membership.expires_at >= effective_starts_on then
    effective_starts_on := active_membership.expires_at + 1;
  end if;

  normalized_notes := nullif(btrim(notes_input), '');

  select public.assign_customer_membership_package(
    request_record.customer_id,
    request_record.offer_id,
    effective_starts_on,
    coalesce(normalized_notes, request_record.notes)
  )
  into inserted_membership;

  update public.customer_membership_requests
  set
    status = 'approved',
    decided_at = timezone('utc', now()),
    decision_notes = normalized_notes,
    membership_id = inserted_membership.id,
    decided_by_user_id = auth.uid()
  where id = request_record.id;

  return inserted_membership;
end;
$$;

revoke all on function public.approve_customer_membership_request(uuid, date, text) from public, anon;
grant execute on function public.approve_customer_membership_request(uuid, date, text) to authenticated, service_role;

create or replace function public.reject_customer_membership_request(
  request_uuid uuid,
  notes_input text default null
)
returns public.customer_membership_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon public.salons;
  request_record public.customer_membership_requests;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into owner_salon
  from public.salons
  where owner_user_id = auth.uid();

  if owner_salon.id is null then
    raise exception 'owner_salon_not_found';
  end if;

  update public.customer_membership_requests
  set
    status = 'rejected',
    decided_at = timezone('utc', now()),
    decision_notes = nullif(btrim(notes_input), ''),
    decided_by_user_id = auth.uid()
  where id = request_uuid
    and salon_id = owner_salon.id
    and status = 'pending'
  returning * into request_record;

  if request_record.id is null then
    raise exception 'membership_request_not_pending';
  end if;

  return request_record;
end;
$$;

revoke all on function public.reject_customer_membership_request(uuid, text) from public, anon;
grant execute on function public.reject_customer_membership_request(uuid, text) to authenticated, service_role;

create table if not exists private.customer_membership_renewal_runs (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.customer_memberships (id) on delete cascade,
  reminder_stage text not null check (reminder_stage in ('renewal_5d', 'renewal_today')),
  notification_id uuid references public.salon_customer_notifications (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (membership_id, reminder_stage)
);

create index if not exists customer_membership_renewal_runs_membership_idx
on private.customer_membership_renewal_runs (membership_id, created_at desc);

create or replace function public.queue_due_membership_renewal_notifications(
  run_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  reminder_record record;
  automation_run_id uuid;
  queued_notification_id uuid;
  queued_count integer := 0;
begin
  for reminder_record in
    with due_memberships as (
      select
        membership.id as membership_id,
        membership.salon_id,
        membership.customer_id,
        membership.offer_id,
        membership.title,
        membership.expires_at,
        coalesce(nullif(btrim(customer.name), ''), 'cliente') as customer_name,
        coalesce(nullif(btrim(salon.timezone), ''), 'America/Sao_Paulo') as salon_timezone,
        greatest(
          0,
          membership.expires_at
          - (run_at at time zone coalesce(nullif(btrim(salon.timezone), ''), 'America/Sao_Paulo'))::date
        )::integer as days_remaining
      from public.customer_memberships membership
      join public.customers customer
        on customer.id = membership.customer_id
      join public.salons salon
        on salon.id = membership.salon_id
      where membership.status = 'active'
        and membership.expires_at >= (
          run_at at time zone coalesce(nullif(btrim(salon.timezone), ''), 'America/Sao_Paulo')
        )::date
    ),
    staged_memberships as (
      select
        *,
        case
          when days_remaining = 5 then 'renewal_5d'
          when days_remaining = 0 then 'renewal_today'
          else null
        end as reminder_stage
      from due_memberships
    )
    select *
    from staged_memberships staged
    where staged.reminder_stage is not null
      and not exists (
        select 1
        from private.customer_membership_renewal_runs existing_run
        where existing_run.membership_id = staged.membership_id
          and existing_run.reminder_stage = staged.reminder_stage
      )
    order by staged.expires_at asc
  loop
    automation_run_id := null;
    queued_notification_id := null;

    insert into private.customer_membership_renewal_runs (
      membership_id,
      reminder_stage,
      notification_id
    )
    values (
      reminder_record.membership_id,
      reminder_record.reminder_stage,
      null
    )
    on conflict (membership_id, reminder_stage) do nothing
    returning id into automation_run_id;

    if automation_run_id is null then
      continue;
    end if;

    begin
      insert into public.salon_customer_notifications (
        salon_id,
        customer_id,
        audience,
        notification_type,
        title,
        body,
        payload
      )
      values (
        reminder_record.salon_id,
        reminder_record.customer_id,
        'single_customer',
        'membership_renewal_reminder',
        case
          when reminder_record.days_remaining = 0 then 'Seu plano vence hoje'
          else 'Seu plano está perto de vencer'
        end,
        left(
          case
            when reminder_record.days_remaining = 0 then
              format(
                '%s, o plano %s vence hoje. Se quiser continuar com os benefícios, peça a renovação no app.',
                reminder_record.customer_name,
                reminder_record.title
              )
            else
              format(
                '%s, faltam %s dias para o plano %s vencer. Peça a renovação no app para continuar com os benefícios.',
                reminder_record.customer_name,
                reminder_record.days_remaining,
                reminder_record.title
              )
          end,
          280
        ),
        jsonb_build_object(
          'type', 'membership_renewal_reminder',
          'ctaTarget', 'profile',
          'membershipId', reminder_record.membership_id,
          'offerId', reminder_record.offer_id,
          'membershipTitle', reminder_record.title,
          'expiresAt', reminder_record.expires_at,
          'daysRemaining', reminder_record.days_remaining,
          'reminderStage', reminder_record.reminder_stage
        )
      )
      returning id into queued_notification_id;

      update private.customer_membership_renewal_runs
      set notification_id = queued_notification_id
      where id = automation_run_id;
    exception
      when others then
        delete from private.customer_membership_renewal_runs
        where id = automation_run_id;

        raise log 'queue_due_membership_renewal_notifications failed for membership %: %', reminder_record.membership_id, sqlerrm;
        continue;
    end;

    queued_count := queued_count + 1;
  end loop;

  return jsonb_build_object(
    'processedAt', run_at,
    'membershipRenewalQueued', queued_count
  );
end;
$$;

revoke all on function public.queue_due_membership_renewal_notifications(timestamptz) from public, anon;
grant execute on function public.queue_due_membership_renewal_notifications(timestamptz) to authenticated, service_role;

do $scheduler$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      null;
  end;

  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'dispatch-membership-renewal-reminders';
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'dispatch-membership-renewal-reminders',
      '15 12 * * *',
      $job$select public.queue_due_membership_renewal_notifications(timezone('utc', now()));$job$
    );
  end if;
exception
  when others then
    null;
end;
$scheduler$;

do $publication$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_membership_requests'
  ) then
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.customer_membership_requests;
  exception
    when others then
      null;
  end;
end;
$publication$;

alter table public.salon_referral_programs
add column if not exists required_qualified_referrals integer not null default 10,
add column if not exists reward_service_id uuid references public.services (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_referral_programs_required_qualified_referrals_check'
  ) then
    alter table public.salon_referral_programs
    add constraint salon_referral_programs_required_qualified_referrals_check
    check (required_qualified_referrals between 1 and 100);
  end if;
end;
$$;

create index if not exists salon_referral_programs_reward_service_idx
on public.salon_referral_programs (reward_service_id);

create or replace function public.validate_salon_referral_program_reward_service()
returns trigger
language plpgsql
as $$
declare
  reward_service_salon_id uuid;
begin
  if new.reward_service_id is null then
    return new;
  end if;

  select salon_id
  into reward_service_salon_id
  from public.services
  where id = new.reward_service_id;

  if reward_service_salon_id is null or reward_service_salon_id <> new.salon_id then
    raise exception 'invalid_referral_reward_service';
  end if;

  return new;
end;
$$;

drop trigger if exists salon_referral_programs_validate_reward_service on public.salon_referral_programs;

create trigger salon_referral_programs_validate_reward_service
before insert or update of reward_service_id, salon_id
on public.salon_referral_programs
for each row
execute function public.validate_salon_referral_program_reward_service();

create table if not exists public.salon_referral_reward_unlocks (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  referral_program_id uuid references public.salon_referral_programs (id) on delete set null,
  referrer_customer_id uuid not null references public.customers (id) on delete cascade,
  latest_referral_event_id uuid references public.salon_referral_events (id) on delete set null,
  reward_service_id uuid references public.services (id) on delete set null,
  reward_service_name text,
  reward_description text not null,
  required_qualified_referrals integer not null,
  threshold_reached integer not null,
  status text not null default 'available' check (status in ('available', 'redeemed')),
  unlocked_at timestamptz not null default timezone('utc', now()),
  redeemed_at timestamptz,
  check (char_length(btrim(reward_description)) between 1 and 220),
  check (reward_service_name is null or char_length(btrim(reward_service_name)) between 1 and 120),
  check (required_qualified_referrals >= 1),
  check (threshold_reached >= required_qualified_referrals),
  check (mod(threshold_reached, required_qualified_referrals) = 0),
  check (
    (status = 'redeemed' and redeemed_at is not null)
    or (status = 'available' and redeemed_at is null)
  ),
  unique (referrer_customer_id, threshold_reached)
);

create index if not exists salon_referral_reward_unlocks_salon_idx
on public.salon_referral_reward_unlocks (salon_id, unlocked_at desc);

create index if not exists salon_referral_reward_unlocks_customer_idx
on public.salon_referral_reward_unlocks (referrer_customer_id, status, unlocked_at desc);

alter table public.salon_referral_reward_unlocks enable row level security;

drop policy if exists "owners_manage_salon_referral_reward_unlocks" on public.salon_referral_reward_unlocks;
drop policy if exists "customers_read_own_salon_referral_reward_unlocks" on public.salon_referral_reward_unlocks;

create policy "owners_manage_salon_referral_reward_unlocks"
on public.salon_referral_reward_unlocks
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_salon_referral_reward_unlocks"
on public.salon_referral_reward_unlocks
for select
to authenticated
using (
  public.is_customer_of_salon(salon_id)
  and referrer_customer_id = public.current_customer_id()
);

create or replace function public.reconcile_referral_reward_unlocks(
  target_referrer_customer_id uuid,
  target_salon_id uuid,
  latest_event_id uuid default null
)
returns setof public.salon_referral_reward_unlocks
language plpgsql
security definer
set search_path = public
as $$
declare
  active_program public.salon_referral_programs;
  reward_service public.services;
  qualified_count integer := 0;
  unlock_batch integer := 0;
  threshold_value integer := 0;
  reward_copy text;
  inserted_unlock public.salon_referral_reward_unlocks;
begin
  if target_referrer_customer_id is null or target_salon_id is null then
    return;
  end if;

  select *
  into active_program
  from public.salon_referral_programs
  where salon_id = target_salon_id
    and is_active
  order by updated_at desc
  limit 1;

  if active_program.id is null or coalesce(active_program.required_qualified_referrals, 0) < 1 then
    return;
  end if;

  if active_program.reward_service_id is not null then
    select *
    into reward_service
    from public.services
    where id = active_program.reward_service_id
      and salon_id = target_salon_id;
  end if;

  reward_copy := coalesce(
    nullif(btrim(active_program.reward_for_referrer), ''),
    case
      when reward_service.id is not null then format('1 %s liberado no salão.', reward_service.name)
      else format(
        'A cada %s indicações validadas, 1 recompensa é liberada no salão.',
        active_program.required_qualified_referrals
      )
    end
  );

  select count(*)::int
  into qualified_count
  from public.salon_referral_events
  where salon_id = target_salon_id
    and referrer_customer_id = target_referrer_customer_id
    and status = 'qualified';

  if qualified_count < active_program.required_qualified_referrals then
    return;
  end if;

  for unlock_batch in 1..floor(qualified_count::numeric / active_program.required_qualified_referrals)::int loop
    threshold_value := unlock_batch * active_program.required_qualified_referrals;

    insert into public.salon_referral_reward_unlocks (
      salon_id,
      referral_program_id,
      referrer_customer_id,
      latest_referral_event_id,
      reward_service_id,
      reward_service_name,
      reward_description,
      required_qualified_referrals,
      threshold_reached
    )
    values (
      target_salon_id,
      active_program.id,
      target_referrer_customer_id,
      latest_event_id,
      reward_service.id,
      nullif(btrim(reward_service.name), ''),
      reward_copy,
      active_program.required_qualified_referrals,
      threshold_value
    )
    on conflict (referrer_customer_id, threshold_reached) do nothing
    returning * into inserted_unlock;

    if found then
      return next inserted_unlock;
    end if;
  end loop;

  return;
end;
$$;

create or replace function public.reconcile_salon_referral_reward_unlocks(
  target_salon_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer record;
  inserted_count integer := 0;
begin
  if auth.uid() is null or not public.is_owner_of_salon(target_salon_id) then
    raise exception 'forbidden';
  end if;

  for referrer in
    select distinct referrer_customer_id
    from public.salon_referral_events
    where salon_id = target_salon_id
      and referrer_customer_id is not null
  loop
    inserted_count := inserted_count + (
      select count(*)
      from public.reconcile_referral_reward_unlocks(referrer.referrer_customer_id, target_salon_id, null)
    );
  end loop;

  return inserted_count;
end;
$$;

grant execute on function public.reconcile_referral_reward_unlocks(uuid, uuid, uuid) to authenticated;
grant execute on function public.reconcile_salon_referral_reward_unlocks(uuid) to authenticated;

create or replace function public.handle_referral_reward_unlocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'qualified' and coalesce(old.status, '') <> 'qualified' then
    perform public.reconcile_referral_reward_unlocks(new.referrer_customer_id, new.salon_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists salon_referral_events_reconcile_reward_unlocks on public.salon_referral_events;

create trigger salon_referral_events_reconcile_reward_unlocks
after update on public.salon_referral_events
for each row
execute function public.handle_referral_reward_unlocks();

create or replace function public.handle_referral_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_customer_name text;
  active_program public.salon_referral_programs;
  qualified_count integer := 0;
  progress_count integer := 0;
begin
  if new.status = 'qualified' and coalesce(old.status, '') <> 'qualified' then
    select name
    into invited_customer_name
    from public.customers
    where id = new.invited_customer_id;

    select *
    into active_program
    from public.salon_referral_programs
    where id = new.referral_program_id;

    select count(*)::int
    into qualified_count
    from public.salon_referral_events
    where salon_id = new.salon_id
      and referrer_customer_id = new.referrer_customer_id
      and status = 'qualified';

    progress_count := case
      when coalesce(active_program.required_qualified_referrals, 0) > 0
        then mod(qualified_count, active_program.required_qualified_referrals)
      else qualified_count
    end;

    if coalesce(active_program.required_qualified_referrals, 0) > 0 and progress_count = 0 and qualified_count > 0 then
      progress_count := active_program.required_qualified_referrals;
    end if;

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
      new.salon_id,
      new.referrer_customer_id,
      'single_customer',
      'referral_qualified',
      'Sua indicação foi validada',
      case
        when coalesce(active_program.required_qualified_referrals, 0) > 0 then
          format(
            '%s concluiu a primeira visita. Seu progresso agora é %s de %s indicações validadas.',
            coalesce(invited_customer_name, 'Seu convidado'),
            progress_count,
            active_program.required_qualified_referrals
          )
        else
          format('%s concluiu a primeira visita no salão.', coalesce(invited_customer_name, 'Seu convidado'))
      end,
      jsonb_build_object(
        'type', 'referral_qualified',
        'referralEventId', new.id,
        'customerId', new.invited_customer_id,
        'qualifiedCount', qualified_count,
        'progressCount', progress_count,
        'requiredQualifiedReferrals', active_program.required_qualified_referrals
      )
    );

    if active_program.reward_for_invited is not null and btrim(active_program.reward_for_invited) <> '' then
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
        new.salon_id,
        new.invited_customer_id,
        'single_customer',
        'referral_reward_unlocked',
        'Seu benefício de indicação foi liberado',
        format('Sua primeira visita foi confirmada. Benefício disponível: %s.', active_program.reward_for_invited),
        jsonb_build_object(
          'type', 'referral_reward_unlocked',
          'referralEventId', new.id,
          'customerId', new.invited_customer_id
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_referral_reward_unlock_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.latest_referral_event_id is null then
    return new;
  end if;

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
    new.salon_id,
    new.referrer_customer_id,
    'single_customer',
    'referral_reward_unlocked',
    'Sua recompensa de indicação foi liberada',
    case
      when new.reward_service_name is not null and btrim(new.reward_service_name) <> '' then
        format(
          'Você atingiu %s indicações validadas. Recompensa liberada: %s.',
          new.threshold_reached,
          new.reward_service_name
        )
      else
        format(
          'Você atingiu %s indicações validadas. Recompensa liberada: %s.',
          new.threshold_reached,
          new.reward_description
        )
    end,
    jsonb_build_object(
      'type', 'referral_reward_unlocked',
      'referralRewardUnlockId', new.id,
      'thresholdReached', new.threshold_reached,
      'requiredQualifiedReferrals', new.required_qualified_referrals,
      'rewardDescription', new.reward_description,
      'rewardServiceName', new.reward_service_name
    )
  );

  return new;
end;
$$;

drop trigger if exists salon_referral_reward_unlocks_notify_customers on public.salon_referral_reward_unlocks;

create trigger salon_referral_reward_unlocks_notify_customers
after insert on public.salon_referral_reward_unlocks
for each row
execute function public.handle_referral_reward_unlock_notifications();

create or replace function public.get_customer_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  customer_profile public.customers;
  active_program public.salon_referral_programs;
  reward_service public.services;
  pending_count integer := 0;
  qualified_count integer := 0;
  current_cycle_progress integer := 0;
  next_reward_remaining integer := 0;
  unlocked_rewards_count integer := 0;
  available_rewards_count integer := 0;
  referrals jsonb := '[]'::jsonb;
  reward_unlocks jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid();

  if customer_profile.id is null then
    raise exception 'customer_not_linked';
  end if;

  select *
  into active_program
  from public.salon_referral_programs
  where salon_id = customer_profile.salon_id
    and is_active
  order by updated_at desc
  limit 1;

  if active_program.reward_service_id is not null then
    select *
    into reward_service
    from public.services
    where id = active_program.reward_service_id
      and salon_id = customer_profile.salon_id;
  end if;

  select
    count(*) filter (where status = 'pending')::int,
    count(*) filter (where status = 'qualified')::int
  into pending_count, qualified_count
  from public.salon_referral_events
  where referrer_customer_id = customer_profile.id;

  if coalesce(active_program.required_qualified_referrals, 0) > 0 then
    current_cycle_progress := mod(qualified_count, active_program.required_qualified_referrals);
    next_reward_remaining := case
      when qualified_count = 0 then active_program.required_qualified_referrals
      when current_cycle_progress = 0 then active_program.required_qualified_referrals
      else active_program.required_qualified_referrals - current_cycle_progress
    end;
  end if;

  select
    count(*)::int,
    count(*) filter (where status = 'available')::int
  into unlocked_rewards_count, available_rewards_count
  from public.salon_referral_reward_unlocks
  where referrer_customer_id = customer_profile.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'customer_name', coalesce(invited.name, 'Cliente'),
        'status', event.status,
        'qualified_at', event.qualified_at,
        'created_at', event.created_at
      )
      order by event.created_at desc
    ),
    '[]'::jsonb
  )
  into referrals
  from public.salon_referral_events event
  left join public.customers invited
    on invited.id = event.invited_customer_id
  where event.referrer_customer_id = customer_profile.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', unlock.id,
        'threshold_reached', unlock.threshold_reached,
        'required_qualified_referrals', unlock.required_qualified_referrals,
        'reward_description', unlock.reward_description,
        'reward_service_name', unlock.reward_service_name,
        'status', unlock.status,
        'unlocked_at', unlock.unlocked_at,
        'redeemed_at', unlock.redeemed_at
      )
      order by unlock.unlocked_at desc
    ),
    '[]'::jsonb
  )
  into reward_unlocks
  from (
    select *
    from public.salon_referral_reward_unlocks
    where referrer_customer_id = customer_profile.id
    order by unlocked_at desc
    limit 5
  ) unlock;

  return jsonb_build_object(
    'referral_code', customer_profile.referral_code,
    'pending_count', pending_count,
    'qualified_count', qualified_count,
    'current_cycle_progress', current_cycle_progress,
    'next_reward_remaining', next_reward_remaining,
    'unlocked_rewards_count', unlocked_rewards_count,
    'available_rewards_count', available_rewards_count,
    'program',
    case
      when active_program.id is null then null
      else jsonb_build_object(
        'title', active_program.title,
        'description', active_program.description,
        'reward_for_referrer', active_program.reward_for_referrer,
        'reward_for_invited', active_program.reward_for_invited,
        'is_active', active_program.is_active,
        'required_qualified_referrals', active_program.required_qualified_referrals,
        'reward_service_id', active_program.reward_service_id,
        'reward_service_name', nullif(btrim(reward_service.name), '')
      )
    end,
    'referrals', referrals,
    'reward_unlocks', reward_unlocks
  );
end;
$$;

grant execute on function public.get_customer_referral_summary() to authenticated;

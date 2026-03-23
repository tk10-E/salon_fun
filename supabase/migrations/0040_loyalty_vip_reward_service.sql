alter table public.salon_loyalty_programs
add column if not exists vip_reward_service_id uuid references public.services (id) on delete set null;

create index if not exists salon_loyalty_programs_vip_reward_service_idx
on public.salon_loyalty_programs (vip_reward_service_id);

create or replace function public.ensure_loyalty_reward_service_matches_salon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_service_salon_id uuid;
begin
  if new.vip_reward_service_id is null then
    return new;
  end if;

  select salon_id
  into reward_service_salon_id
  from public.services
  where id = new.vip_reward_service_id;

  if reward_service_salon_id is null then
    raise exception 'vip_reward_service_not_found';
  end if;

  if reward_service_salon_id <> new.salon_id then
    raise exception 'vip_reward_service_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists salon_loyalty_programs_validate_reward_service on public.salon_loyalty_programs;

create trigger salon_loyalty_programs_validate_reward_service
before insert or update on public.salon_loyalty_programs
for each row
execute function public.ensure_loyalty_reward_service_matches_salon();

create or replace function public.get_customer_loyalty_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  customer_profile public.customers;
  configured_program public.salon_loyalty_programs;
  points_balance integer := 0;
  total_points_earned integer := 0;
  cashback_balance numeric(10, 2) := 0;
  total_cashback_earned numeric(10, 2) := 0;
  completed_visits integer := 0;
  rank_position integer := null;
  ranked_customers integer := 0;
  current_tier jsonb := null;
  next_tier jsonb := null;
  last_reward_at timestamptz := null;
  vip_reward_service_name text := null;
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
  into configured_program
  from public.salon_loyalty_programs
  where salon_id = customer_profile.salon_id
  limit 1;

  if configured_program.vip_reward_service_id is not null then
    select name
    into vip_reward_service_name
    from public.services
    where id = configured_program.vip_reward_service_id
      and salon_id = customer_profile.salon_id;
  end if;

  select
    coalesce(sum(loyalty.points_delta), 0)::integer,
    coalesce(sum(case when loyalty.points_delta > 0 then loyalty.points_delta else 0 end), 0)::integer,
    coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2),
    coalesce(sum(case when loyalty.cashback_delta > 0 then loyalty.cashback_delta else 0 end), 0)::numeric(10, 2),
    coalesce(sum(loyalty.completed_visit_delta), 0)::integer,
    max(loyalty.created_at)
  into
    points_balance,
    total_points_earned,
    cashback_balance,
    total_cashback_earned,
    completed_visits,
    last_reward_at
  from public.customer_loyalty_transactions loyalty
  where loyalty.customer_id = customer_profile.id;

  if configured_program.id is not null then
    current_tier := public.resolve_loyalty_tier_snapshot(
      configured_program.tier_one_name,
      configured_program.tier_one_min_visits,
      configured_program.tier_one_discount_percent,
      configured_program.tier_two_name,
      configured_program.tier_two_min_visits,
      configured_program.tier_two_discount_percent,
      configured_program.vip_tier_name,
      configured_program.vip_min_visits,
      configured_program.vip_discount_percent,
      completed_visits
    );

    next_tier := public.next_loyalty_tier_snapshot(
      configured_program.tier_one_name,
      configured_program.tier_one_min_visits,
      configured_program.tier_one_discount_percent,
      configured_program.tier_two_name,
      configured_program.tier_two_min_visits,
      configured_program.tier_two_discount_percent,
      configured_program.vip_tier_name,
      configured_program.vip_min_visits,
      configured_program.vip_discount_percent,
      completed_visits
    );
  end if;

  with balances as (
    select
      customer.id as customer_id,
      coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
      coalesce(sum(loyalty.completed_visit_delta), 0)::integer as completed_visits,
      coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance
    from public.customers customer
    left join public.customer_loyalty_transactions loyalty
      on loyalty.customer_id = customer.id
    where customer.salon_id = customer_profile.salon_id
    group by customer.id
  ),
  ranked as (
    select
      balance.customer_id,
      dense_rank() over (
        order by
          balance.points_balance desc,
          balance.completed_visits desc,
          balance.cashback_balance desc,
          balance.customer_id asc
      ) as position,
      count(*) over () as total_ranked
    from balances balance
    where balance.points_balance > 0
       or balance.completed_visits > 0
       or balance.cashback_balance > 0
  )
  select ranked.position, ranked.total_ranked
  into rank_position, ranked_customers
  from ranked
  where ranked.customer_id = customer_profile.id;

  ranked_customers := coalesce(ranked_customers, 0);

  return jsonb_build_object(
    'program',
    case
      when configured_program.id is null then null
      else jsonb_build_object(
        'title', configured_program.title,
        'description', configured_program.description,
        'points_per_visit', configured_program.points_per_visit,
        'cashback_percent', configured_program.cashback_percent,
        'is_active', configured_program.is_active,
        'vip_reward_service_id', configured_program.vip_reward_service_id,
        'vip_reward_service_name', vip_reward_service_name,
        'tiers', public.build_loyalty_tiers_snapshot(
          configured_program.tier_one_name,
          configured_program.tier_one_min_visits,
          configured_program.tier_one_discount_percent,
          configured_program.tier_two_name,
          configured_program.tier_two_min_visits,
          configured_program.tier_two_discount_percent,
          configured_program.vip_tier_name,
          configured_program.vip_min_visits,
          configured_program.vip_discount_percent
        )
      )
    end,
    'points_balance', points_balance,
    'total_points_earned', total_points_earned,
    'cashback_balance', cashback_balance,
    'total_cashback_earned', total_cashback_earned,
    'completed_visits', completed_visits,
    'rank_position', rank_position,
    'ranked_customers', ranked_customers,
    'current_tier', current_tier,
    'next_tier', next_tier,
    'visits_to_next_tier',
    case
      when next_tier is null then 0
      else greatest(((next_tier ->> 'min_visits')::integer - completed_visits), 0)
    end,
    'last_reward_at', last_reward_at
  );
end;
$$;

grant execute on function public.get_customer_loyalty_summary() to authenticated;

create or replace function public.get_salon_loyalty_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner_salon_id uuid;
  configured_program public.salon_loyalty_programs;
  overview jsonb := jsonb_build_object(
    'ranked_customers', 0,
    'vip_customers', 0,
    'total_completed_visits', 0,
    'total_points_earned', 0,
    'total_cashback_earned', 0
  );
  leaderboard jsonb := '[]'::jsonb;
  vip_reward_service_name text := null;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  select *
  into configured_program
  from public.salon_loyalty_programs
  where salon_id = owner_salon_id
  limit 1;

  if configured_program.vip_reward_service_id is not null then
    select name
    into vip_reward_service_name
    from public.services
    where id = configured_program.vip_reward_service_id
      and salon_id = owner_salon_id;
  end if;

  with balances as (
    select
      customer.id as customer_id,
      customer.name as customer_name,
      coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
      coalesce(sum(case when loyalty.points_delta > 0 then loyalty.points_delta else 0 end), 0)::integer as total_points_earned,
      coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance,
      coalesce(sum(case when loyalty.cashback_delta > 0 then loyalty.cashback_delta else 0 end), 0)::numeric(10, 2) as total_cashback_earned,
      coalesce(sum(loyalty.completed_visit_delta), 0)::integer as completed_visits,
      max(loyalty.created_at) as last_reward_at
    from public.customers customer
    left join public.customer_loyalty_transactions loyalty
      on loyalty.customer_id = customer.id
    where customer.salon_id = owner_salon_id
    group by customer.id, customer.name
  ),
  ranked as (
    select
      balance.*,
      dense_rank() over (
        order by
          balance.points_balance desc,
          balance.completed_visits desc,
          balance.cashback_balance desc,
          balance.customer_name asc
      ) as rank_position
    from balances balance
    where balance.points_balance > 0
       or balance.completed_visits > 0
       or balance.cashback_balance > 0
  )
  select jsonb_build_object(
    'ranked_customers', coalesce(count(*), 0),
    'vip_customers',
      coalesce(sum(
        case
          when configured_program.id is not null
            and (public.resolve_loyalty_tier_snapshot(
              configured_program.tier_one_name,
              configured_program.tier_one_min_visits,
              configured_program.tier_one_discount_percent,
              configured_program.tier_two_name,
              configured_program.tier_two_min_visits,
              configured_program.tier_two_discount_percent,
              configured_program.vip_tier_name,
              configured_program.vip_min_visits,
              configured_program.vip_discount_percent,
              ranked.completed_visits
            ) ->> 'is_vip')::boolean
          then 1
          else 0
        end
      ), 0),
    'total_completed_visits', coalesce(sum(ranked.completed_visits), 0),
    'total_points_earned', coalesce(sum(ranked.total_points_earned), 0),
    'total_cashback_earned', coalesce(round(sum(ranked.total_cashback_earned), 2), 0)
  )
  into overview
  from ranked;

  with balances as (
    select
      customer.id as customer_id,
      customer.name as customer_name,
      coalesce(sum(loyalty.points_delta), 0)::integer as points_balance,
      coalesce(sum(case when loyalty.points_delta > 0 then loyalty.points_delta else 0 end), 0)::integer as total_points_earned,
      coalesce(sum(loyalty.cashback_delta), 0)::numeric(10, 2) as cashback_balance,
      coalesce(sum(case when loyalty.cashback_delta > 0 then loyalty.cashback_delta else 0 end), 0)::numeric(10, 2) as total_cashback_earned,
      coalesce(sum(loyalty.completed_visit_delta), 0)::integer as completed_visits,
      max(loyalty.created_at) as last_reward_at
    from public.customers customer
    left join public.customer_loyalty_transactions loyalty
      on loyalty.customer_id = customer.id
    where customer.salon_id = owner_salon_id
    group by customer.id, customer.name
  ),
  ranked as (
    select
      balance.*,
      dense_rank() over (
        order by
          balance.points_balance desc,
          balance.completed_visits desc,
          balance.cashback_balance desc,
          balance.customer_name asc
      ) as rank_position
    from balances balance
    where balance.points_balance > 0
       or balance.completed_visits > 0
       or balance.cashback_balance > 0
  ),
  top_ranked as (
    select *
    from ranked
    order by rank_position, customer_name
    limit 8
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'customer_id', top_ranked.customer_id,
        'customer_name', top_ranked.customer_name,
        'rank_position', top_ranked.rank_position,
        'points_balance', top_ranked.points_balance,
        'total_points_earned', top_ranked.total_points_earned,
        'cashback_balance', top_ranked.cashback_balance,
        'total_cashback_earned', top_ranked.total_cashback_earned,
        'completed_visits', top_ranked.completed_visits,
        'current_tier',
        case
          when configured_program.id is null then null
          else public.resolve_loyalty_tier_snapshot(
            configured_program.tier_one_name,
            configured_program.tier_one_min_visits,
            configured_program.tier_one_discount_percent,
            configured_program.tier_two_name,
            configured_program.tier_two_min_visits,
            configured_program.tier_two_discount_percent,
            configured_program.vip_tier_name,
            configured_program.vip_min_visits,
            configured_program.vip_discount_percent,
            top_ranked.completed_visits
          )
        end,
        'last_reward_at', top_ranked.last_reward_at
      )
      order by top_ranked.rank_position, top_ranked.customer_name
    ),
    '[]'::jsonb
  )
  into leaderboard
  from top_ranked;

  return jsonb_build_object(
    'program',
    case
      when configured_program.id is null then null
      else jsonb_build_object(
        'title', configured_program.title,
        'description', configured_program.description,
        'points_per_visit', configured_program.points_per_visit,
        'cashback_percent', configured_program.cashback_percent,
        'tier_one_name', configured_program.tier_one_name,
        'tier_one_min_visits', configured_program.tier_one_min_visits,
        'tier_one_discount_percent', configured_program.tier_one_discount_percent,
        'tier_two_name', configured_program.tier_two_name,
        'tier_two_min_visits', configured_program.tier_two_min_visits,
        'tier_two_discount_percent', configured_program.tier_two_discount_percent,
        'vip_tier_name', configured_program.vip_tier_name,
        'vip_min_visits', configured_program.vip_min_visits,
        'vip_discount_percent', configured_program.vip_discount_percent,
        'vip_reward_service_id', configured_program.vip_reward_service_id,
        'vip_reward_service_name', vip_reward_service_name,
        'is_active', configured_program.is_active,
        'tiers', public.build_loyalty_tiers_snapshot(
          configured_program.tier_one_name,
          configured_program.tier_one_min_visits,
          configured_program.tier_one_discount_percent,
          configured_program.tier_two_name,
          configured_program.tier_two_min_visits,
          configured_program.tier_two_discount_percent,
          configured_program.vip_tier_name,
          configured_program.vip_min_visits,
          configured_program.vip_discount_percent
        )
      )
    end,
    'overview', overview,
    'leaderboard', leaderboard
  );
end;
$$;

grant execute on function public.get_salon_loyalty_dashboard() to authenticated;

create or replace function public.sync_appointment_loyalty_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_program public.salon_loyalty_programs;
  service_record public.services;
  reward_record public.customer_loyalty_transactions;
  previous_visits integer := 0;
  current_tier jsonb := null;
  unlocked_tier jsonb := null;
  cashback_earned numeric(10, 2) := 0;
  discount_label text;
  vip_reward_service_name text := null;
begin
  if tg_op = 'UPDATE' then
    if coalesce(old.status::text, '') = 'completed'
       and new.status::text <> 'completed' then
      delete from public.customer_loyalty_transactions
      where appointment_id = new.id
        and transaction_kind = 'visit_reward';

      return new;
    end if;

    if coalesce(old.status::text, '') = 'completed' then
      return new;
    end if;
  end if;

  if new.status::text <> 'completed' or new.customer_id is null then
    return new;
  end if;

  select *
  into active_program
  from public.salon_loyalty_programs
  where salon_id = new.salon_id
    and is_active = true
  limit 1;

  if active_program.id is null then
    return new;
  end if;

  select *
  into service_record
  from public.services
  where id = new.service_id;

  if active_program.vip_reward_service_id is not null then
    select name
    into vip_reward_service_name
    from public.services
    where id = active_program.vip_reward_service_id
      and salon_id = new.salon_id;
  end if;

  select coalesce(sum(loyalty.completed_visit_delta), 0)::integer
  into previous_visits
  from public.customer_loyalty_transactions loyalty
  where loyalty.customer_id = new.customer_id;

  current_tier := public.resolve_loyalty_tier_snapshot(
    active_program.tier_one_name,
    active_program.tier_one_min_visits,
    active_program.tier_one_discount_percent,
    active_program.tier_two_name,
    active_program.tier_two_min_visits,
    active_program.tier_two_discount_percent,
    active_program.vip_tier_name,
    active_program.vip_min_visits,
    active_program.vip_discount_percent,
    previous_visits
  );

  cashback_earned := round(coalesce(service_record.price, 0) * active_program.cashback_percent / 100.0, 2);

  insert into public.customer_loyalty_transactions (
    salon_id,
    customer_id,
    loyalty_program_id,
    appointment_id,
    transaction_kind,
    points_delta,
    cashback_delta,
    completed_visit_delta,
    description,
    metadata
  )
  values (
    new.salon_id,
    new.customer_id,
    active_program.id,
    new.id,
    'visit_reward',
    active_program.points_per_visit,
    cashback_earned,
    1,
    'Recompensa automática por atendimento concluído.',
    jsonb_build_object(
      'serviceName', coalesce(service_record.name, 'Atendimento'),
      'completedAt', coalesce(new.completed_at, timezone('utc', now())),
      'pointsPerVisit', active_program.points_per_visit,
      'cashbackPercent', active_program.cashback_percent
    )
  )
  on conflict (appointment_id) do nothing
  returning * into reward_record;

  if reward_record.id is null then
    return new;
  end if;

  unlocked_tier := public.resolve_loyalty_tier_snapshot(
    active_program.tier_one_name,
    active_program.tier_one_min_visits,
    active_program.tier_one_discount_percent,
    active_program.tier_two_name,
    active_program.tier_two_min_visits,
    active_program.tier_two_discount_percent,
    active_program.vip_tier_name,
    active_program.vip_min_visits,
    active_program.vip_discount_percent,
    previous_visits + 1
  );

  if current_tier ->> 'label' is distinct from unlocked_tier ->> 'label' then
    discount_label := public.format_loyalty_number_label((unlocked_tier ->> 'discount_percent')::numeric);

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
        new.salon_id,
        new.customer_id,
        'single_customer',
        case
          when (unlocked_tier ->> 'is_vip')::boolean then 'loyalty_vip_unlocked'
          else 'loyalty_tier_unlocked'
        end,
        case
          when (unlocked_tier ->> 'is_vip')::boolean then 'Você virou cliente VIP'
          else 'Novo nível de fidelidade liberado'
        end,
        case
          when (unlocked_tier ->> 'is_vip')::boolean and vip_reward_service_name is not null then
            format(
              'Seu histórico no salão liberou o nível %s com %s%% de desconto progressivo e %s como recompensa especial.',
              unlocked_tier ->> 'label',
              discount_label,
              vip_reward_service_name
            )
          when (unlocked_tier ->> 'is_vip')::boolean then
            format(
              'Seu histórico no salão liberou o nível %s com %s%% de desconto progressivo.',
              unlocked_tier ->> 'label',
              discount_label
            )
          else
            format(
              'Você alcançou %s e agora desbloqueou %s%% de desconto progressivo.',
              unlocked_tier ->> 'label',
              discount_label
            )
        end,
        jsonb_build_object(
          'type',
          case
            when (unlocked_tier ->> 'is_vip')::boolean then 'loyalty_vip_unlocked'
            else 'loyalty_tier_unlocked'
          end,
          'appointmentId', new.id,
          'tier', unlocked_tier,
          'pointsEarned', active_program.points_per_visit,
          'cashbackEarned', cashback_earned,
          'vipRewardServiceName', vip_reward_service_name
        )
      );
    exception
      when others then
        raise log 'Failed to queue loyalty tier notification for appointment %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
exception
  when others then
    raise log 'sync_appointment_loyalty_reward failed for appointment %: %', new.id, sqlerrm;
    return new;
end;
$$;

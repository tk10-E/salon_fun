create table if not exists public.salon_loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references public.salons (id) on delete cascade,
  title text not null default 'Clube de fidelidade',
  description text,
  points_per_visit integer not null default 10,
  cashback_percent numeric(5, 2) not null default 5,
  tier_one_name text not null default 'Cliente Frequente',
  tier_one_min_visits integer not null default 3,
  tier_one_discount_percent numeric(5, 2) not null default 5,
  tier_two_name text not null default 'Cliente Ouro',
  tier_two_min_visits integer not null default 6,
  tier_two_discount_percent numeric(5, 2) not null default 10,
  vip_tier_name text not null default 'Cliente VIP',
  vip_min_visits integer not null default 10,
  vip_discount_percent numeric(5, 2) not null default 15,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(title)) between 1 and 120),
  check (description is null or char_length(btrim(description)) between 1 and 500),
  check (points_per_visit between 1 and 1000),
  check (cashback_percent between 0 and 100),
  check (char_length(btrim(tier_one_name)) between 1 and 60),
  check (char_length(btrim(tier_two_name)) between 1 and 60),
  check (char_length(btrim(vip_tier_name)) between 1 and 60),
  check (tier_one_min_visits >= 1),
  check (tier_two_min_visits > tier_one_min_visits),
  check (vip_min_visits > tier_two_min_visits),
  check (tier_one_discount_percent between 0 and 100),
  check (tier_two_discount_percent between tier_one_discount_percent and 100),
  check (vip_discount_percent between tier_two_discount_percent and 100)
);

create or replace function public.touch_salon_loyalty_program_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists salon_loyalty_programs_touch_updated_at on public.salon_loyalty_programs;

create trigger salon_loyalty_programs_touch_updated_at
before update on public.salon_loyalty_programs
for each row
execute function public.touch_salon_loyalty_program_updated_at();

alter table public.salon_loyalty_programs enable row level security;

drop policy if exists "owners_manage_salon_loyalty_programs" on public.salon_loyalty_programs;
drop policy if exists "customers_read_salon_loyalty_programs" on public.salon_loyalty_programs;

create policy "owners_manage_salon_loyalty_programs"
on public.salon_loyalty_programs
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

create policy "customers_read_salon_loyalty_programs"
on public.salon_loyalty_programs
for select
to authenticated
using (public.is_customer_of_salon(salon_id));

create table if not exists public.customer_loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  loyalty_program_id uuid references public.salon_loyalty_programs (id) on delete set null,
  appointment_id uuid unique references public.appointments (id) on delete cascade,
  transaction_kind text not null default 'visit_reward'
    check (transaction_kind in ('visit_reward', 'manual_adjustment', 'cashback_redemption')),
  points_delta integer not null default 0,
  cashback_delta numeric(10, 2) not null default 0,
  completed_visit_delta integer not null default 0,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (description is null or char_length(btrim(description)) between 1 and 240),
  check (jsonb_typeof(metadata) = 'object'),
  check (points_delta <> 0 or cashback_delta <> 0 or completed_visit_delta <> 0),
  check (
    (
      transaction_kind = 'visit_reward'
      and appointment_id is not null
      and completed_visit_delta = 1
      and points_delta >= 0
      and cashback_delta >= 0
    )
    or (
      transaction_kind = 'manual_adjustment'
      and appointment_id is null
    )
    or (
      transaction_kind = 'cashback_redemption'
      and appointment_id is null
      and cashback_delta <= 0
    )
  )
);

create index if not exists customer_loyalty_transactions_salon_customer_idx
on public.customer_loyalty_transactions (salon_id, customer_id, created_at desc);

create index if not exists customer_loyalty_transactions_customer_idx
on public.customer_loyalty_transactions (customer_id, created_at desc);

alter table public.customer_loyalty_transactions enable row level security;

drop policy if exists "owners_manage_customer_loyalty_transactions" on public.customer_loyalty_transactions;
drop policy if exists "customers_read_own_loyalty_transactions" on public.customer_loyalty_transactions;

create policy "owners_manage_customer_loyalty_transactions"
on public.customer_loyalty_transactions
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (
  public.is_owner_of_salon(salon_id)
  and exists (
    select 1
    from public.customers customer_profile
    where customer_profile.id = customer_id
      and customer_profile.salon_id = salon_id
  )
);

create policy "customers_read_own_loyalty_transactions"
on public.customer_loyalty_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.customers customer_profile
    where customer_profile.id = customer_id
      and customer_profile.auth_user_id = auth.uid()
  )
);

create or replace function public.format_loyalty_number_label(value numeric)
returns text
language sql
immutable
as $$
  select replace(
    trim(trailing '.' from trim(trailing '0' from to_char(coalesce(value, 0), 'FM999999990.00'))),
    '.',
    ','
  );
$$;

create or replace function public.format_loyalty_currency_label(value numeric)
returns text
language sql
immutable
as $$
  select 'R$ ' || public.format_loyalty_number_label(round(coalesce(value, 0), 2));
$$;

create or replace function public.resolve_loyalty_tier_snapshot(
  tier_one_name_input text,
  tier_one_min_visits_input integer,
  tier_one_discount_percent_input numeric,
  tier_two_name_input text,
  tier_two_min_visits_input integer,
  tier_two_discount_percent_input numeric,
  vip_tier_name_input text,
  vip_min_visits_input integer,
  vip_discount_percent_input numeric,
  completed_visits_input integer
)
returns jsonb
language plpgsql
immutable
as $$
declare
  tier_label text := 'Começando agora';
  min_visits integer := 0;
  discount_percent numeric(5, 2) := 0;
  is_vip boolean := false;
  completed_visits integer := greatest(coalesce(completed_visits_input, 0), 0);
begin
  if completed_visits >= coalesce(vip_min_visits_input, 0) then
    tier_label := vip_tier_name_input;
    min_visits := vip_min_visits_input;
    discount_percent := coalesce(vip_discount_percent_input, 0);
    is_vip := true;
  elsif completed_visits >= coalesce(tier_two_min_visits_input, 0) then
    tier_label := tier_two_name_input;
    min_visits := tier_two_min_visits_input;
    discount_percent := coalesce(tier_two_discount_percent_input, 0);
  elsif completed_visits >= coalesce(tier_one_min_visits_input, 0) then
    tier_label := tier_one_name_input;
    min_visits := tier_one_min_visits_input;
    discount_percent := coalesce(tier_one_discount_percent_input, 0);
  end if;

  return jsonb_build_object(
    'label', tier_label,
    'min_visits', min_visits,
    'discount_percent', discount_percent,
    'is_vip', is_vip
  );
end;
$$;

create or replace function public.next_loyalty_tier_snapshot(
  tier_one_name_input text,
  tier_one_min_visits_input integer,
  tier_one_discount_percent_input numeric,
  tier_two_name_input text,
  tier_two_min_visits_input integer,
  tier_two_discount_percent_input numeric,
  vip_tier_name_input text,
  vip_min_visits_input integer,
  vip_discount_percent_input numeric,
  completed_visits_input integer
)
returns jsonb
language plpgsql
immutable
as $$
declare
  completed_visits integer := greatest(coalesce(completed_visits_input, 0), 0);
begin
  if completed_visits < coalesce(tier_one_min_visits_input, 0) then
    return jsonb_build_object(
      'label', tier_one_name_input,
      'min_visits', tier_one_min_visits_input,
      'discount_percent', coalesce(tier_one_discount_percent_input, 0),
      'is_vip', false
    );
  end if;

  if completed_visits < coalesce(tier_two_min_visits_input, 0) then
    return jsonb_build_object(
      'label', tier_two_name_input,
      'min_visits', tier_two_min_visits_input,
      'discount_percent', coalesce(tier_two_discount_percent_input, 0),
      'is_vip', false
    );
  end if;

  if completed_visits < coalesce(vip_min_visits_input, 0) then
    return jsonb_build_object(
      'label', vip_tier_name_input,
      'min_visits', vip_min_visits_input,
      'discount_percent', coalesce(vip_discount_percent_input, 0),
      'is_vip', true
    );
  end if;

  return null;
end;
$$;

create or replace function public.build_loyalty_tiers_snapshot(
  tier_one_name_input text,
  tier_one_min_visits_input integer,
  tier_one_discount_percent_input numeric,
  tier_two_name_input text,
  tier_two_min_visits_input integer,
  tier_two_discount_percent_input numeric,
  vip_tier_name_input text,
  vip_min_visits_input integer,
  vip_discount_percent_input numeric
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'label', tier_one_name_input,
      'min_visits', tier_one_min_visits_input,
      'discount_percent', coalesce(tier_one_discount_percent_input, 0),
      'is_vip', false
    ),
    jsonb_build_object(
      'label', tier_two_name_input,
      'min_visits', tier_two_min_visits_input,
      'discount_percent', coalesce(tier_two_discount_percent_input, 0),
      'is_vip', false
    ),
    jsonb_build_object(
      'label', vip_tier_name_input,
      'min_visits', vip_min_visits_input,
      'discount_percent', coalesce(vip_discount_percent_input, 0),
      'is_vip', true
    )
  );
$$;

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

  if new.status::text <> 'completed' then
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
          'cashbackEarned', cashback_earned
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

drop trigger if exists appointments_sync_loyalty_reward on public.appointments;

create trigger appointments_sync_loyalty_reward
after insert or update of status on public.appointments
for each row
execute function public.sync_appointment_loyalty_reward();

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'salon_loyalty_programs'
  ) then
    alter publication supabase_realtime add table public.salon_loyalty_programs;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_loyalty_transactions'
  ) then
    alter publication supabase_realtime add table public.customer_loyalty_transactions;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;

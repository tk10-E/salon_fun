create table if not exists public.saas_plan_catalog (
  id text primary key,
  display_name text not null,
  description text not null,
  monthly_price numeric(10, 2) not null check (monthly_price >= 0),
  yearly_price numeric(10, 2) not null check (yearly_price >= 0),
  currency_code text not null default 'BRL',
  trial_days integer not null default 0 check (trial_days >= 0 and trial_days <= 60),
  max_staff_members integer check (max_staff_members is null or max_staff_members > 0),
  max_services integer check (max_services is null or max_services > 0),
  max_monthly_notifications integer check (
    max_monthly_notifications is null
    or max_monthly_notifications > 0
  ),
  includes_growth_automation boolean not null default false,
  includes_feed_video boolean not null default false,
  includes_custom_branding boolean not null default false,
  includes_priority_support boolean not null default false,
  is_default boolean not null default false,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.salon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references public.salons (id) on delete cascade,
  plan_id text not null references public.saas_plan_catalog (id) on delete restrict,
  status text not null default 'trialing' check (
    status in ('trialing', 'active', 'past_due', 'paused', 'canceled')
  ),
  billing_interval text not null default 'monthly' check (
    billing_interval in ('monthly', 'yearly')
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  activated_at timestamptz,
  canceled_at timestamptz,
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    trial_started_at is null
    or trial_ends_at is null
    or trial_ends_at >= trial_started_at
  ),
  check (
    current_period_started_at is null
    or current_period_ends_at is null
    or current_period_ends_at >= current_period_started_at
  )
);

create index if not exists saas_plan_catalog_public_sort_idx
on public.saas_plan_catalog (is_public, sort_order, display_name);

create index if not exists salon_subscriptions_status_idx
on public.salon_subscriptions (status, current_period_ends_at);

create or replace function public.touch_saas_plan_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.touch_salon_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists saas_plan_catalog_touch_updated_at on public.saas_plan_catalog;
create trigger saas_plan_catalog_touch_updated_at
before update on public.saas_plan_catalog
for each row
execute function public.touch_saas_plan_catalog_updated_at();

drop trigger if exists salon_subscriptions_touch_updated_at on public.salon_subscriptions;
create trigger salon_subscriptions_touch_updated_at
before update on public.salon_subscriptions
for each row
execute function public.touch_salon_subscriptions_updated_at();

insert into public.saas_plan_catalog (
  id,
  display_name,
  description,
  monthly_price,
  yearly_price,
  currency_code,
  trial_days,
  max_staff_members,
  max_services,
  max_monthly_notifications,
  includes_growth_automation,
  includes_feed_video,
  includes_custom_branding,
  includes_priority_support,
  is_default,
  is_public,
  sort_order,
  metadata
)
values
  (
    'starter',
    'Starter',
    'Ideal para lançar o app do salão com identidade própria, agenda e catálogo essencial.',
    79,
    790,
    'BRL',
    14,
    3,
    25,
    1500,
    false,
    false,
    true,
    false,
    true,
    true,
    10,
    jsonb_build_object(
      'highlight', 'Entrada rápida com trial automático',
      'tagline', 'Operação base e app do cliente no ar'
    )
  ),
  (
    'growth',
    'Growth',
    'Para salões que já operam campanhas, conteúdo recorrente e automações de retenção.',
    149,
    1490,
    'BRL',
    7,
    8,
    80,
    10000,
    true,
    true,
    true,
    false,
    false,
    true,
    20,
    jsonb_build_object(
      'highlight', 'Vídeo no feed e automação inteligente',
      'tagline', 'Escala comercial com mais equipe e campanhas'
    )
  ),
  (
    'premium',
    'Premium',
    'Camada completa para operação madura com branding avançado, escala e suporte prioritário.',
    249,
    2490,
    'BRL',
    7,
    25,
    250,
    50000,
    true,
    true,
    true,
    true,
    false,
    true,
    30,
    jsonb_build_object(
      'highlight', 'Escala máxima com suporte prioritário',
      'tagline', 'Estrutura pronta para grupos, multi-equipe e alto volume'
    )
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  currency_code = excluded.currency_code,
  trial_days = excluded.trial_days,
  max_staff_members = excluded.max_staff_members,
  max_services = excluded.max_services,
  max_monthly_notifications = excluded.max_monthly_notifications,
  includes_growth_automation = excluded.includes_growth_automation,
  includes_feed_video = excluded.includes_feed_video,
  includes_custom_branding = excluded.includes_custom_branding,
  includes_priority_support = excluded.includes_priority_support,
  is_default = excluded.is_default,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

update public.saas_plan_catalog
set is_default = (id = 'starter')
where is_default is distinct from (id = 'starter');

create or replace function public.seed_default_salon_subscription(target_salon_id uuid)
returns public.salon_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_subscription public.salon_subscriptions;
  default_plan public.saas_plan_catalog;
begin
  select *
  into existing_subscription
  from public.salon_subscriptions
  where salon_id = target_salon_id;

  if existing_subscription.id is not null then
    return existing_subscription;
  end if;

  select *
  into default_plan
  from public.saas_plan_catalog
  where is_default = true
  order by sort_order asc, display_name asc
  limit 1;

  if default_plan.id is null then
    raise exception 'default_plan_not_configured';
  end if;

  insert into public.salon_subscriptions (
    salon_id,
    plan_id,
    status,
    billing_interval,
    trial_started_at,
    trial_ends_at
  )
  values (
    target_salon_id,
    default_plan.id,
    case when default_plan.trial_days > 0 then 'trialing' else 'active' end,
    'monthly',
    timezone('utc', now()),
    case
      when default_plan.trial_days > 0
        then timezone('utc', now()) + make_interval(days => default_plan.trial_days)
      else null
    end
  )
  returning * into existing_subscription;

  return existing_subscription;
end;
$$;

create or replace function public.seed_default_salon_subscription_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_salon_subscription(new.id);
  return new;
end;
$$;

drop trigger if exists salons_seed_default_subscription on public.salons;
create trigger salons_seed_default_subscription
after insert on public.salons
for each row
execute function public.seed_default_salon_subscription_trigger();

insert into public.salon_subscriptions (
  salon_id,
  plan_id,
  status,
  billing_interval,
  trial_started_at,
  trial_ends_at
)
select
  salons.id,
  default_plan.id,
  case when default_plan.trial_days > 0 then 'trialing' else 'active' end,
  'monthly',
  timezone('utc', now()),
  case
    when default_plan.trial_days > 0
      then timezone('utc', now()) + make_interval(days => default_plan.trial_days)
    else null
  end
from public.salons
cross join lateral (
  select *
  from public.saas_plan_catalog
  where is_default = true
  order by sort_order asc, display_name asc
  limit 1
) as default_plan
left join public.salon_subscriptions
  on public.salon_subscriptions.salon_id = salons.id
where public.salon_subscriptions.id is null;

alter table public.saas_plan_catalog enable row level security;
alter table public.salon_subscriptions enable row level security;

drop policy if exists "authenticated_users_read_plan_catalog" on public.saas_plan_catalog;
create policy "authenticated_users_read_plan_catalog"
on public.saas_plan_catalog
for select
to authenticated
using (is_public = true);

drop policy if exists "owners_read_their_subscription" on public.salon_subscriptions;
create policy "owners_read_their_subscription"
on public.salon_subscriptions
for select
to authenticated
using (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_their_subscription" on public.salon_subscriptions;
create policy "owners_manage_their_subscription"
on public.salon_subscriptions
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

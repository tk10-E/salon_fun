update public.saas_plan_catalog
set
  trial_days = 0,
  metadata = metadata || case
    when id = 'starter' then jsonb_build_object(
      'highlight', 'Liberação do painel logo após o pagamento',
      'tagline', 'Base operacional para entrar no ar com segurança'
    )
    when id = 'growth' then jsonb_build_object(
      'highlight', 'Mais equipe, campanhas e retenção ativa'
    )
    else '{}'::jsonb
  end,
  updated_at = timezone('utc', now())
where id in ('starter', 'growth', 'premium');

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
    'paused',
    'monthly',
    null,
    null
  )
  returning * into existing_subscription;

  return existing_subscription;
end;
$$;

update public.salon_subscriptions
set
  status = 'paused',
  trial_started_at = null,
  trial_ends_at = null,
  current_period_started_at = null,
  current_period_ends_at = null,
  grace_ends_at = null,
  activated_at = null,
  canceled_at = null,
  updated_at = timezone('utc', now())
where activated_at is null
  and provider_subscription_id is null
  and status in ('trialing', 'active');

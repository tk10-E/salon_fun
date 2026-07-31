update public.saas_plan_catalog
set
  trial_days = 3,
  updated_at = timezone('utc', now())
where id in ('starter', 'growth', 'premium');

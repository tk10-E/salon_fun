create table if not exists public.salon_customer_notifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  audience text not null default 'salon_customers' check (audience in ('salon_customers', 'single_customer')),
  notification_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(notification_type)) between 1 and 80),
  check (char_length(btrim(title)) between 1 and 120),
  check (char_length(btrim(body)) between 1 and 280),
  check (jsonb_typeof(payload) = 'object'),
  check (
    (audience = 'single_customer' and customer_id is not null)
    or (audience = 'salon_customers' and customer_id is null)
  )
);

create index if not exists salon_customer_notifications_salon_idx
on public.salon_customer_notifications (salon_id, created_at desc);

create index if not exists salon_customer_notifications_customer_idx
on public.salon_customer_notifications (customer_id, created_at desc)
where customer_id is not null;

alter table public.salon_customer_notifications enable row level security;

drop policy if exists "owners_manage_salon_customer_notifications" on public.salon_customer_notifications;
drop policy if exists "customers_read_relevant_salon_customer_notifications" on public.salon_customer_notifications;

create policy "owners_manage_salon_customer_notifications"
on public.salon_customer_notifications
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (
  public.is_owner_of_salon(salon_id)
  and (
    customer_id is null
    or exists (
      select 1
      from public.customers customer_profile
      where customer_profile.id = customer_id
        and customer_profile.salon_id = salon_id
    )
  )
);

create policy "customers_read_relevant_salon_customer_notifications"
on public.salon_customer_notifications
for select
to authenticated
using (
  (audience = 'salon_customers' and public.is_customer_of_salon(salon_id))
  or exists (
    select 1
    from public.customers customer_profile
    where customer_profile.id = customer_id
      and customer_profile.auth_user_id = auth.uid()
  )
);

create or replace function public.queue_customer_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text;
  webhook_secret text;
begin
  select value
  into function_url
  from private.runtime_config
  where key = 'vacancy_push_function_url'
  limit 1;

  select value
  into webhook_secret
  from private.runtime_config
  where key = 'vacancy_push_webhook_secret'
  limit 1;

  if nullif(coalesce(function_url, ''), '') is null
     or nullif(coalesce(webhook_secret, ''), '') is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-vacancy-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'notification_id', new.id,
      'salon_id', new.salon_id
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists salon_customer_notifications_dispatch_push on public.salon_customer_notifications;

create trigger salon_customer_notifications_dispatch_push
after insert on public.salon_customer_notifications
for each row
execute function public.queue_customer_push_notification();

create or replace function public.handle_referral_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_customer_name text;
  active_program public.salon_referral_programs;
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
        when active_program.reward_for_referrer is not null and btrim(active_program.reward_for_referrer) <> '' then
          format(
            '%s concluiu a primeira visita. Benefício liberado: %s.',
            coalesce(invited_customer_name, 'Seu convidado'),
            active_program.reward_for_referrer
          )
        else
          format('%s concluiu a primeira visita no salão.', coalesce(invited_customer_name, 'Seu convidado'))
      end,
      jsonb_build_object(
        'type', 'referral_qualified',
        'referralEventId', new.id,
        'customerId', new.invited_customer_id
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

drop trigger if exists salon_referral_events_notify_customers on public.salon_referral_events;

create trigger salon_referral_events_notify_customers
after update on public.salon_referral_events
for each row
execute function public.handle_referral_event_notifications();

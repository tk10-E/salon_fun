alter table public.salon_customer_notifications
  add column if not exists whatsapp_delivery_status text,
  add column if not exists whatsapp_status_at timestamptz,
  add column if not exists whatsapp_delivered_at timestamptz,
  add column if not exists whatsapp_read_at timestamptz;

create index if not exists salon_customer_notifications_whatsapp_message_idx
on public.salon_customer_notifications (whatsapp_message_id)
where whatsapp_message_id is not null;

create table if not exists public.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  from_phone text not null,
  profile_name text,
  message_id text not null unique,
  message_type text not null default 'text',
  message_body text,
  interpreted_intent text,
  handled_action text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists whatsapp_inbound_messages_salon_created_idx
on public.whatsapp_inbound_messages (salon_id, created_at desc);

create index if not exists whatsapp_inbound_messages_appointment_created_idx
on public.whatsapp_inbound_messages (appointment_id, created_at desc)
where appointment_id is not null;

alter table public.whatsapp_inbound_messages enable row level security;

drop policy if exists "owners_manage_whatsapp_inbound_messages"
on public.whatsapp_inbound_messages;

create policy "owners_manage_whatsapp_inbound_messages"
on public.whatsapp_inbound_messages
for all
using (
  salon_id is not null
  and exists (
    select 1
    from public.salons salon
    where salon.id = whatsapp_inbound_messages.salon_id
      and salon.owner_user_id = auth.uid()
  )
)
with check (
  salon_id is not null
  and exists (
    select 1
    from public.salons salon
    where salon.id = whatsapp_inbound_messages.salon_id
      and salon.owner_user_id = auth.uid()
  )
);

create or replace function public.find_whatsapp_customer_context(
  phone_input text
)
returns table (
  salon_id uuid,
  salon_name text,
  customer_id uuid,
  customer_name text,
  appointment_id uuid,
  appointment_status text,
  appointment_date timestamptz,
  service_name text,
  staff_member_name text,
  customer_confirmation_requested_at timestamptz,
  customer_presence_confirmed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with normalized_phone as (
    select regexp_replace(coalesce(phone_input, ''), '\D', '', 'g') as digits
  ),
  candidate_customers as (
    select
      customer.id as customer_id,
      customer.salon_id,
      customer.name as customer_name,
      customer.created_at,
      regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') as customer_phone_digits
    from public.customers customer
    join normalized_phone normalized
      on normalized.digits <> ''
    where regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') <> ''
      and (
        regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') = normalized.digits
        or (
          length(regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g')) >= 11
          and right(regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g'), 11) = right(normalized.digits, 11)
        )
        or (
          length(regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g')) >= 10
          and right(regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g'), 10) = right(normalized.digits, 10)
        )
      )
  ),
  ranked_context as (
    select
      candidate.salon_id,
      salon.name as salon_name,
      candidate.customer_id,
      candidate.customer_name,
      appointment.id as appointment_id,
      appointment.status as appointment_status,
      appointment.date as appointment_date,
      service.name as service_name,
      staff_member.name as staff_member_name,
      appointment.customer_confirmation_requested_at,
      appointment.customer_presence_confirmed_at,
      row_number() over (
        order by
          case
            when appointment.id is null then 4
            when appointment.status = 'confirmed'
              and appointment.date >= timezone('utc', now()) - interval '6 hours'
              then 0
            when appointment.status = 'pending'
              and appointment.date >= timezone('utc', now()) - interval '6 hours'
              then 1
            when appointment.status = 'completed' then 2
            when appointment.status = 'cancelled' then 3
            else 4
          end,
          case
            when appointment.id is null then 999999999
            else abs(extract(epoch from appointment.date - timezone('utc', now())))
          end,
          candidate.created_at desc
      ) as row_number
    from candidate_customers candidate
    join public.salons salon
      on salon.id = candidate.salon_id
    left join lateral (
      select *
      from public.appointments appointment
      where appointment.customer_id = candidate.customer_id
        and appointment.salon_id = candidate.salon_id
        and appointment.date >= timezone('utc', now()) - interval '120 days'
      order by
        case
          when appointment.status = 'confirmed'
            and appointment.date >= timezone('utc', now()) - interval '6 hours'
            then 0
          when appointment.status = 'pending'
            and appointment.date >= timezone('utc', now()) - interval '6 hours'
            then 1
          when appointment.status = 'completed' then 2
          when appointment.status = 'cancelled' then 3
          else 4
        end,
        abs(extract(epoch from appointment.date - timezone('utc', now())))
      limit 1
    ) appointment on true
    left join public.services service
      on service.id = appointment.service_id
    left join public.staff_members staff_member
      on staff_member.id = appointment.staff_member_id
  )
  select
    ranked_context.salon_id,
    ranked_context.salon_name,
    ranked_context.customer_id,
    ranked_context.customer_name,
    ranked_context.appointment_id,
    ranked_context.appointment_status,
    ranked_context.appointment_date,
    ranked_context.service_name,
    ranked_context.staff_member_name,
    ranked_context.customer_confirmation_requested_at,
    ranked_context.customer_presence_confirmed_at
  from ranked_context
  where ranked_context.row_number = 1;
$$;

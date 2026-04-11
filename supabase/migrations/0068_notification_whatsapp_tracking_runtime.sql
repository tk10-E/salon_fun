alter table public.salon_customer_notifications
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_error text;

create index if not exists salon_customer_notifications_whatsapp_pending_idx
on public.salon_customer_notifications (salon_id, created_at)
where customer_id is not null
  and whatsapp_sent_at is null;

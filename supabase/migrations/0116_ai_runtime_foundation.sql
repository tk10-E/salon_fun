create or replace function public.touch_ai_runtime_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  conversation_key text not null,
  channel text not null default 'panel_assistant',
  title text,
  summary text,
  status text not null default 'active' check (status in ('active', 'archived', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_conversations_conversation_key_length_check check (
    char_length(btrim(conversation_key)) between 3 and 120
  ),
  constraint ai_conversations_title_length_check check (
    title is null or char_length(btrim(title)) between 1 and 120
  ),
  constraint ai_conversations_summary_length_check check (
    summary is null or char_length(btrim(summary)) between 1 and 1000
  ),
  constraint ai_conversations_salon_key_unique unique (salon_id, conversation_key)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  intent text,
  model text,
  prompt_profile text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_messages_content_length_check check (
    char_length(btrim(content)) between 1 and 12000
  ),
  constraint ai_messages_model_length_check check (
    model is null or char_length(btrim(model)) between 1 and 160
  ),
  constraint ai_messages_prompt_profile_length_check check (
    prompt_profile is null or char_length(btrim(prompt_profile)) between 1 and 160
  )
);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  scope text not null check (scope in ('short', 'long')),
  memory_key text not null,
  memory_value jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz not null default timezone('utc', now()),
  constraint ai_memory_key_length_check check (
    char_length(btrim(memory_key)) between 2 and 120
  ),
  constraint ai_memory_source_length_check check (
    source is null or char_length(btrim(source)) between 1 and 120
  ),
  constraint ai_memory_salon_scope_key_unique unique (salon_id, scope, memory_key)
);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  message_id uuid references public.ai_messages (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  type text not null,
  label text not null,
  target_href text,
  status text not null default 'suggested' check (
    status in ('suggested', 'confirmed', 'executed', 'dismissed', 'failed')
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  executed_at timestamptz,
  constraint ai_actions_type_length_check check (
    char_length(btrim(type)) between 2 and 80
  ),
  constraint ai_actions_label_length_check check (
    char_length(btrim(label)) between 1 and 160
  ),
  constraint ai_actions_target_href_length_check check (
    target_href is null or char_length(btrim(target_href)) between 1 and 240
  )
);

create table if not exists public.ai_tool_logs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete cascade,
  message_id uuid references public.ai_messages (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  tool_id text not null,
  tool_label text,
  status text not null default 'requested' check (
    status in ('requested', 'succeeded', 'failed', 'blocked', 'suggested')
  ),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  error_detail text,
  duration_ms integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_tool_logs_tool_id_length_check check (
    char_length(btrim(tool_id)) between 2 and 120
  ),
  constraint ai_tool_logs_tool_label_length_check check (
    tool_label is null or char_length(btrim(tool_label)) between 1 and 120
  ),
  constraint ai_tool_logs_error_detail_length_check check (
    error_detail is null or char_length(btrim(error_detail)) between 1 and 2000
  ),
  constraint ai_tool_logs_duration_ms_check check (
    duration_ms is null or duration_ms >= 0
  )
);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete cascade,
  message_id uuid references public.ai_messages (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  rating integer check (rating between 1 and 5),
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_feedback_comment_length_check check (
    comment is null or char_length(btrim(comment)) between 1 and 2000
  )
);

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_settings_key_length_check check (
    char_length(btrim(setting_key)) between 2 and 120
  ),
  constraint ai_settings_salon_key_unique unique (salon_id, setting_key)
);

create index if not exists ai_conversations_salon_channel_last_message_idx
on public.ai_conversations (salon_id, channel, last_message_at desc);

create index if not exists ai_messages_conversation_created_idx
on public.ai_messages (conversation_id, created_at asc);

create index if not exists ai_messages_salon_created_idx
on public.ai_messages (salon_id, created_at desc);

create index if not exists ai_memory_salon_scope_last_used_idx
on public.ai_memory (salon_id, scope, last_used_at desc);

create index if not exists ai_actions_conversation_status_created_idx
on public.ai_actions (conversation_id, status, created_at desc);

create index if not exists ai_tool_logs_conversation_created_idx
on public.ai_tool_logs (conversation_id, created_at desc);

create index if not exists ai_feedback_salon_created_idx
on public.ai_feedback (salon_id, created_at desc);

create index if not exists ai_settings_salon_key_idx
on public.ai_settings (salon_id, setting_key);

drop trigger if exists ai_conversations_touch_updated_at on public.ai_conversations;
create trigger ai_conversations_touch_updated_at
before update on public.ai_conversations
for each row
execute function public.touch_ai_runtime_updated_at();

drop trigger if exists ai_memory_touch_updated_at on public.ai_memory;
create trigger ai_memory_touch_updated_at
before update on public.ai_memory
for each row
execute function public.touch_ai_runtime_updated_at();

drop trigger if exists ai_settings_touch_updated_at on public.ai_settings;
create trigger ai_settings_touch_updated_at
before update on public.ai_settings
for each row
execute function public.touch_ai_runtime_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_memory enable row level security;
alter table public.ai_actions enable row level security;
alter table public.ai_tool_logs enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_settings enable row level security;

drop policy if exists "owners_manage_ai_conversations" on public.ai_conversations;
create policy "owners_manage_ai_conversations"
on public.ai_conversations
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_ai_messages" on public.ai_messages;
create policy "owners_manage_ai_messages"
on public.ai_messages
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_ai_memory" on public.ai_memory;
create policy "owners_manage_ai_memory"
on public.ai_memory
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_ai_actions" on public.ai_actions;
create policy "owners_manage_ai_actions"
on public.ai_actions
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_ai_tool_logs" on public.ai_tool_logs;
create policy "owners_manage_ai_tool_logs"
on public.ai_tool_logs
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_ai_feedback" on public.ai_feedback;
create policy "owners_manage_ai_feedback"
on public.ai_feedback
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

drop policy if exists "owners_manage_ai_settings" on public.ai_settings;
create policy "owners_manage_ai_settings"
on public.ai_settings
for all
to authenticated
using (public.is_owner_of_salon(salon_id))
with check (public.is_owner_of_salon(salon_id));

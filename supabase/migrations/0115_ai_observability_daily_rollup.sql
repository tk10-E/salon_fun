create index if not exists security_audit_logs_salon_event_created_idx
on public.security_audit_logs (salon_id, event_type, created_at desc)
where salon_id is not null;

create or replace view public.ai_observability_daily_rollup as
with normalized_events as (
  select
    timezone('utc', created_at)::date as day,
    salon_id,
    case
      when event_type = 'panel.ai_query' then coalesce(nullif(btrim(metadata ->> 'feature'), ''), 'panel_assistant')
      when event_type like 'ai.%_generated' or event_type like 'ai.%_failed'
        then nullif(substring(event_type from '^ai\.(.+)_(?:generated|failed)$'), '')
      else null
    end as feature,
    case
      when event_type = 'panel.ai_query' then nullif(btrim(metadata ->> 'model'), '')
      else coalesce(
        nullif(btrim(metadata ->> 'aiModel'), ''),
        nullif(btrim(metadata ->> 'model'), '')
      )
    end as model,
    nullif(btrim(metadata ->> 'promptProfile'), '') as prompt_profile,
    nullif(btrim(metadata ->> 'skillId'), '') as skill_id,
    coalesce(
      nullif(btrim(metadata ->> 'skillLabel'), ''),
      nullif(btrim(metadata ->> 'skillId'), '')
    ) as skill_label,
    case
      when event_type = 'panel.ai_query' then 'answered'
      when event_type like 'ai.%_failed' then 'failed'
      when event_type like 'ai.%_generated' then 'generated'
      else null
    end as outcome,
    case
      when event_type = 'panel.ai_query' then position('(fallback)' in coalesce(metadata ->> 'model', '')) > 0
      else lower(coalesce(metadata ->> 'usedFallback', 'false')) = 'true'
    end as used_fallback
  from public.security_audit_logs
  where salon_id is not null
    and (
      event_type = 'panel.ai_query'
      or event_type like 'ai.%_generated'
      or event_type like 'ai.%_failed'
    )
)
select
  day,
  salon_id,
  feature,
  model,
  prompt_profile,
  skill_id,
  skill_label,
  outcome,
  count(*)::integer as event_count,
  count(*) filter (where used_fallback)::integer as fallback_count
from normalized_events
where feature is not null
  and outcome is not null
group by
  day,
  salon_id,
  feature,
  model,
  prompt_profile,
  skill_id,
  skill_label,
  outcome;

create extension if not exists pg_net;

create or replace function public.dispatch_operations_autopilot_job()
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select value
  into dispatch_url
  from private.runtime_config
  where key = 'operations_autopilot_job_url'
  limit 1;

  select value
  into dispatch_secret
  from private.runtime_config
  where key = 'operations_autopilot_job_secret'
  limit 1;

  if nullif(coalesce(dispatch_url, ''), '') is null
     or nullif(coalesce(dispatch_secret, ''), '') is null then
    return;
  end if;

  perform net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', format('Bearer %s', dispatch_secret)
    ),
    body := jsonb_build_object(
      'source', 'supabase_cron'
    )
  );
exception
  when others then
    null;
end;
$$;

do $scheduler$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      null;
  end;

  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'dispatch-operations-autopilot';
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'dispatch-operations-autopilot',
      '*/5 * * * *',
      $job$select public.dispatch_operations_autopilot_job();$job$
    );
  end if;
exception
  when others then
    null;
end;
$scheduler$;

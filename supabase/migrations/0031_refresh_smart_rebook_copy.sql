alter table public.salon_growth_automation_settings
  alter column smart_rebook_title set default 'Hora do seu próximo {service_name}',
  alter column smart_rebook_body_template set default 'Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.';

update public.salon_growth_automation_settings
set
  smart_rebook_title = 'Hora do seu próximo {service_name}',
  smart_rebook_body_template = 'Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.'
where btrim(coalesce(smart_rebook_title, '')) in (
    '',
    'Você sempre agenda {service_name} {habit_weekday} 👀'
  )
  and btrim(coalesce(smart_rebook_body_template, '')) in (
    '',
    'Seu próximo {service_name} está chegando. Quer deixar para {target_weekday} {target_period}? Se quiser, ainda dá para encaixar {combo_service_name}.'
  );

create or replace function public.seed_salon_growth_automation_settings(target_salon_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.salon_growth_automation_settings (
    salon_id,
    smart_rebook_title,
    smart_rebook_body_template
  )
  values (
    target_salon_id,
    'Hora do seu próximo {service_name}',
    'Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.'
  )
  on conflict (salon_id) do nothing;
end;
$$;

create or replace function public.seed_salon_growth_automation_settings_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_salon_growth_automation_settings(new.id);
  return new;
end;
$$;

drop trigger if exists salons_seed_growth_automation_settings on public.salons;

create trigger salons_seed_growth_automation_settings
after insert on public.salons
for each row
execute function public.seed_salon_growth_automation_settings_from_trigger();

select public.seed_salon_growth_automation_settings(id)
from public.salons;

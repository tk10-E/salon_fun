create or replace function public.detect_service_growth_segment(
  service_name text,
  service_category text default null
)
returns text
language sql
immutable
as $$
  with normalized as (
    select trim(
      concat_ws(
        ' ',
        public.normalize_growth_text(service_category),
        public.normalize_growth_text(service_name)
      )
    ) as value
  )
  select case
    when value like '%barba%' or value like '%beard%' then 'barba'
    when value like '%corte%'
      or value like '%haircut%'
      or value like '%fade%'
      or value like '%degrade%'
      or value like '%cabelo feminino%'
      or value like '%cabelo masculino%' then 'corte'
    when value like '%escova%'
      or value like '%penteado%'
      or value like '%babyliss%'
      or value like '%finaliza%' then 'finalizacao'
    when value like '%manicure%'
      or value like '%mao%'
      or value like '%unha%'
      or value like '%nail%'
      or value like '%esmalta%'
      or value like '%cuticula%'
      or value like '%fibra%'
      or value like '%gel%' then 'manicure'
    when value like '%pedicure%'
      or value like '%podolog%'
      or value like 'pe %'
      or value like '% pe %'
      or value like '% pe'
      or value like '% pes %' then 'pedicure'
    when value like '%color%'
      or value like '%tintura%'
      or value like '%luzes%'
      or value like '%mechas%'
      or value like '%pintura%' then 'coloracao'
    when value like '%hidrat%'
      or value like '%tratamento%'
      or value like '%reconstr%'
      or value like '%botox%'
      or value like '%selagem%'
      or value like '%progressiva%'
      or value like '%cronograma capilar%' then 'tratamento'
    when value like '%sobrancel%'
      or value like '%brow%'
      or value like '%henna%'
      or value like '%laminacao%' then 'sobrancelha'
    when value like '%cilios%'
      or value like '%lash%'
      or value like '%extensao de cilios%'
      or value like '%lifting de cilios%' then 'cilios'
    when value like '%maqui%'
      or value like '%make %'
      or value like '%makeup%' then 'maquiagem'
    when value like '%depila%'
      or value like '%wax%' then 'depilacao'
    when value like '%limpeza de pele%'
      or value like '%facial%'
      or value like '%peeling%'
      or value like '%skin care%'
      or value like '%skincare%'
      or value like '%pele%' then 'facial'
    when value like '%massag%'
      or value like '%drenagem%'
      or value like '%relax%'
      or value like '%modeladora%'
      or value like '%terapeutica%'
      or value like '%spa corporal%'
      or value like '%estetica corporal%' then 'massagem'
    else 'geral'
  end
  from normalized;
$$;

create or replace function public.infer_service_revisit_interval_days(
  service_name text,
  service_category text default null
)
returns integer
language sql
immutable
as $$
  select case public.detect_service_growth_segment(service_name, service_category)
    when 'barba' then 15
    when 'corte' then 30
    when 'finalizacao' then 21
    when 'coloracao' then 45
    when 'tratamento' then 21
    when 'manicure' then 21
    when 'pedicure' then 30
    when 'sobrancelha' then 21
    when 'cilios' then 21
    when 'maquiagem' then 30
    when 'depilacao' then 28
    when 'facial' then 30
    when 'massagem' then 21
    else 30
  end;
$$;

create or replace function public.combo_target_growth_segment(base_segment text)
returns text
language sql
immutable
as $$
  select case coalesce(base_segment, '')
    when 'barba' then 'corte'
    when 'corte' then 'barba'
    when 'finalizacao' then 'tratamento'
    when 'manicure' then 'pedicure'
    when 'pedicure' then 'manicure'
    when 'coloracao' then 'tratamento'
    when 'tratamento' then 'finalizacao'
    when 'sobrancelha' then 'cilios'
    when 'cilios' then 'sobrancelha'
    when 'maquiagem' then 'sobrancelha'
    when 'depilacao' then 'sobrancelha'
    when 'facial' then 'massagem'
    when 'massagem' then 'facial'
    else null
  end;
$$;

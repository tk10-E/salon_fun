create or replace function public.get_public_salon_join_code_by_domain(
  domain_input text
)
returns text
language sql
security definer
set search_path = public
stable
as $$
  with normalized_domain as (
    select
      nullif(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(btrim(coalesce(domain_input, ''))), '^https?://', ''),
            ':\d+$',
            ''
          ),
          '^www\.',
          ''
        ),
        ''
      ) as host
  )
  select salon.join_code
  from public.salons salon
  cross join normalized_domain
  where normalized_domain.host is not null
    and coalesce((salon.client_app_config ->> 'whiteLabelActive')::boolean, false) is true
    and lower(
      btrim(
        regexp_replace(
          coalesce(salon.client_app_config ->> 'customDomain', ''),
          '^www\.',
          ''
        )
      )
    ) = normalized_domain.host
  order by salon.created_at desc
  limit 1;
$$;

grant execute on function public.get_public_salon_join_code_by_domain(text)
to anon, authenticated;

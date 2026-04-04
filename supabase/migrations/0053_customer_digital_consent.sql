alter table public.customers
add column if not exists consent_signed_at timestamptz,
add column if not exists consent_version text;

alter table public.customers
drop constraint if exists customers_consent_version_length_check;

alter table public.customers
add constraint customers_consent_version_length_check
check (consent_version is null or char_length(btrim(consent_version)) between 1 and 80);

update public.customers
set
  consent_signed_at = coalesce(consent_signed_at, timezone('utc', now())),
  consent_version = coalesce(nullif(btrim(consent_version), ''), 'owner-panel-manual-v1')
where consent_status = 'signed';

create table if not exists public.customer_consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  consent_kind text not null check (consent_kind in ('operational_prontuario')),
  consent_version text not null,
  document_title text not null,
  document_body text not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  accepted_source text not null default 'mobile_app'
    check (accepted_source in ('mobile_app', 'owner_panel')),
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(consent_version)) between 1 and 80),
  check (char_length(btrim(document_title)) between 1 and 160),
  check (char_length(btrim(document_body)) between 1 and 4000)
);

create unique index if not exists customer_consent_acceptances_unique_kind_version_idx
on public.customer_consent_acceptances (customer_id, consent_kind, consent_version);

create index if not exists customer_consent_acceptances_salon_idx
on public.customer_consent_acceptances (salon_id, accepted_at desc);

create index if not exists customer_consent_acceptances_customer_idx
on public.customer_consent_acceptances (customer_id, accepted_at desc);

alter table public.customer_consent_acceptances enable row level security;

drop policy if exists "owners_read_customer_consent_acceptances" on public.customer_consent_acceptances;
drop policy if exists "customers_read_own_consent_acceptances" on public.customer_consent_acceptances;

create policy "owners_read_customer_consent_acceptances"
on public.customer_consent_acceptances
for select
to authenticated
using (public.is_owner_of_salon(salon_id));

create policy "customers_read_own_consent_acceptances"
on public.customer_consent_acceptances
for select
to authenticated
using (customer_id = public.current_customer_id());

create or replace function public.accept_customer_operational_consent(
  consent_version_input text default '2026-04-prontuario-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  owner_salon public.salons;
  acceptance_record public.customer_consent_acceptances;
  normalized_version text := left(
    coalesce(nullif(btrim(consent_version_input), ''), '2026-04-prontuario-v1'),
    80
  );
  document_title text := 'Consentimento de atendimento e prontuario';
  document_body text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth_user_id = auth.uid()
  for update;

  if customer_profile.id is null then
    raise exception 'customer_not_linked';
  end if;

  select *
  into owner_salon
  from public.salons
  where id = customer_profile.salon_id;

  if owner_salon.id is null then
    raise exception 'salon_not_found';
  end if;

  document_body := format(
    'Autorizo %s a registrar e consultar, dentro da plataforma Salon Fun, informacoes necessarias para meu atendimento, como preferencias, alergias, produtos usados, objetivo do tratamento, contraindicacoes, observacoes tecnicas e historico relacionado a minha jornada. Esses dados serao usados para personalizar o atendimento, aumentar a seguranca operacional e manter continuidade nas proximas visitas. Posso pedir revisao ou atualizacao das informacoes pelos canais oficiais de suporte do salao.',
    owner_salon.name
  );

  insert into public.customer_consent_acceptances (
    salon_id,
    customer_id,
    consent_kind,
    consent_version,
    document_title,
    document_body,
    accepted_source
  )
  values (
    customer_profile.salon_id,
    customer_profile.id,
    'operational_prontuario',
    normalized_version,
    document_title,
    document_body,
    'mobile_app'
  )
  on conflict (customer_id, consent_kind, consent_version)
  do update set
    document_title = excluded.document_title,
    document_body = excluded.document_body,
    accepted_at = timezone('utc', now()),
    accepted_source = excluded.accepted_source
  returning *
  into acceptance_record;

  update public.customers
  set
    consent_status = 'signed',
    consent_signed_at = acceptance_record.accepted_at,
    consent_version = normalized_version
  where id = customer_profile.id;

  return jsonb_build_object(
    'consent_status', 'signed',
    'consent_signed_at', acceptance_record.accepted_at,
    'consent_version', normalized_version,
    'document_title', document_title,
    'accepted_source', acceptance_record.accepted_source
  );
end;
$$;

grant execute on function public.accept_customer_operational_consent(text)
to authenticated;

drop function if exists public.update_owner_customer_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date
);

create or replace function public.update_owner_customer_profile(
  customer_uuid uuid,
  phone_input text default null,
  preferences_input text default null,
  allergies_input text default null,
  beauty_products_input text default null,
  crm_label_input text default null,
  internal_notes_input text default null,
  beauty_goals_input text default null,
  contraindications_input text default null,
  technical_notes_input text default null,
  consent_status_input text default null,
  last_assessment_at_input date default null
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_salon_id uuid;
  existing_customer public.customers;
  updated_customer public.customers;
  normalized_consent_status text := lower(btrim(coalesce(consent_status_input, '')));
  resolved_consent_status text;
  resolved_consent_signed_at timestamptz;
  resolved_consent_version text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  owner_salon_id := public.current_owner_salon_id();

  if owner_salon_id is null then
    raise exception 'owner_salon_not_found';
  end if;

  if normalized_consent_status not in ('', 'pending', 'signed', 'not_required') then
    raise exception 'invalid_consent_status';
  end if;

  resolved_consent_status := case
    when normalized_consent_status = '' then 'not_required'
    else normalized_consent_status
  end;

  select *
  into existing_customer
  from public.customers
  where id = customer_uuid
    and salon_id = owner_salon_id
  for update;

  if existing_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  resolved_consent_signed_at := case
    when resolved_consent_status = 'signed'
      then coalesce(existing_customer.consent_signed_at, timezone('utc', now()))
    else null
  end;

  resolved_consent_version := case
    when resolved_consent_status = 'signed'
      then coalesce(nullif(btrim(existing_customer.consent_version), ''), 'owner-panel-manual-v1')
    else null
  end;

  update public.customers
  set
    phone = nullif(btrim(phone_input), ''),
    preferences = nullif(btrim(preferences_input), ''),
    allergies = nullif(btrim(allergies_input), ''),
    beauty_products = nullif(btrim(beauty_products_input), ''),
    crm_label = nullif(left(btrim(crm_label_input), 40), ''),
    internal_notes = nullif(left(btrim(internal_notes_input), 2000), ''),
    beauty_goals = nullif(left(btrim(beauty_goals_input), 800), ''),
    contraindications = nullif(left(btrim(contraindications_input), 800), ''),
    technical_notes = nullif(left(btrim(technical_notes_input), 1200), ''),
    consent_status = resolved_consent_status,
    consent_signed_at = resolved_consent_signed_at,
    consent_version = resolved_consent_version,
    last_assessment_at = last_assessment_at_input
  where id = existing_customer.id
  returning *
  into updated_customer;

  return updated_customer;
end;
$$;

grant execute on function public.update_owner_customer_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date
)
to authenticated;

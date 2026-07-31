create or replace function public.get_public_salon_landing_by_join_code(input_join_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_preview record;
  v_join_code text;
begin
  select *
  into v_preview
  from public.get_public_salon_by_join_code(input_join_code)
  limit 1;

  if v_preview.id is null then
    return null;
  end if;

  v_join_code := upper(trim(coalesce(input_join_code, '')));

  return jsonb_build_object(
    'joinCode', v_join_code,
    'preview', jsonb_build_object(
      'salonId', v_preview.id::text,
      'joinCode', v_join_code,
      'name', coalesce(v_preview.name, 'Salão'),
      'tagline', v_preview.tagline,
      'brandColor', coalesce(v_preview.brand_color, '#C15F43'),
      'segmentLabel', 'Salão',
      'segmentDescription', '',
      'moduleLabels', jsonb_build_array(),
      'whatsappPhone', v_preview.whatsapp_phone,
      'bookingPolicyEnabled', coalesce(v_preview.booking_policy_enabled, false),
      'bookingPolicyTitle', v_preview.booking_policy_title,
      'bookingPolicySummary', v_preview.booking_policy_summary,
      'bookingPaymentMode', v_preview.booking_policy_payment_mode,
      'bookingRequiresDeposit', coalesce(v_preview.booking_policy_requires_deposit, false),
      'bookingDepositAmount', v_preview.booking_policy_deposit_amount,
      'bookingPaymentInstructions', v_preview.booking_policy_payment_instructions,
      'bookingPixKey', v_preview.booking_policy_pix_key,
      'bookingPixRecipientName', v_preview.booking_policy_pix_recipient_name,
      'bookingPixRecipientCity', v_preview.booking_policy_pix_recipient_city,
      'bookingExternalCheckoutUrl', v_preview.booking_policy_external_checkout_url
    ),
    'featuredServices', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id::text,
          'name', s.name,
          'category', s.category,
          'description', s.description,
          'duration', s.duration,
          'price', s.price,
          'imageUrl', null
        )
        order by coalesce(s.sort_order, 0), s.name
      )
      from public.services s
      where s.salon_id = v_preview.id
        and s.is_active = true
      limit 12
    ), '[]'::jsonb),
    'activeOffers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id::text,
          'kind', case when o.kind = 'membership' then 'membership' else 'promotion' end,
          'title', o.title,
          'description', o.description,
          'highlightText', o.highlight_text,
          'imageUrl', null,
          'bookingServiceId', o.membership_service_id::text,
          'bookingServiceName', svc.name,
          'actionKind', case
            when o.kind = 'membership' then 'request_membership'
            when o.membership_service_id is not null then 'book_service'
            else 'open_agenda'
          end,
          'kindLabel', case when o.kind = 'membership' then 'Plano' else 'Oferta ativa' end,
          'priceLabel', null,
          'lifecycleLabel', 'Ativo agora'
        )
        order by coalesce(o.sort_order, 0), o.title
      )
      from public.salon_offers o
      left join public.services svc on svc.id = o.membership_service_id
      where o.salon_id = v_preview.id
        and o.is_active = true
      limit 12
    ), '[]'::jsonb),
    'recentPosts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id::text,
          'title', coalesce(nullif(trim(p.title), ''), 'Trabalho recente'),
          'caption', p.caption,
          'imageUrl', null,
          'badge', case
            when p.post_type = 'before_after' then 'Antes e depois'
            when p.post_type = 'reel' then 'Vídeo'
            else null
          end,
          'serviceName', svc.name,
          'staffLabel', st.name,
          'authorAvatarUrl', p.external_author_avatar_url,
          'sourceLabel', null
        )
        order by p.created_at desc
      )
      from public.salon_posts p
      left join public.services svc on svc.id = p.service_id
      left join public.staff_members st on st.id = p.staff_member_id
      where p.salon_id = v_preview.id
      limit 6
    ), '[]'::jsonb),
    'centralCampaigns', '[]'::jsonb,
    'stats', jsonb_build_object(
      'servicesCount', (
        select count(*)
        from public.services s
        where s.salon_id = v_preview.id
          and s.is_active = true
      ),
      'activeOffersCount', (
        select count(*)
        from public.salon_offers o
        where o.salon_id = v_preview.id
          and o.is_active = true
      ),
      'recentPostsCount', (
        select count(*)
        from public.salon_posts p
        where p.salon_id = v_preview.id
      )
    ),
    'links', jsonb_build_object(
      'whatsappUrl',
      case
        when coalesce(v_preview.whatsapp_phone, '') = '' then null
        else 'https://wa.me/' || regexp_replace(v_preview.whatsapp_phone, '\D', '', 'g')
      end,
      'mapUrl', null,
      'supportUrl', null,
      'supportEmail', null,
      'privacyPolicyUrl', null,
      'termsOfUseUrl', null
    )
  );
end;
$$;

grant execute on function public.get_public_salon_landing_by_join_code(text) to anon;
grant execute on function public.get_public_salon_landing_by_join_code(text) to authenticated;

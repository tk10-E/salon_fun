import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';

void main() {
  group('CustomerProfile', () {
    test('parseia status e metadata do consentimento operacional', () {
      final profile = CustomerProfile.fromMap(<String, dynamic>{
        'id': 'customer-1',
        'name': 'Maria',
        'salon_id': 'salon-1',
        'phone': '11988887777',
        'consent_status': 'signed',
        'consent_signed_at': '2026-04-03T18:30:00Z',
        'consent_version': '2026-04-prontuario-v1',
        'salons': <String, dynamic>{'name': 'Studio Glow'},
      });

      expect(profile.salonName, 'Studio Glow');
      expect(profile.hasSignedOperationalConsent, isTrue);
      expect(profile.hasPendingOperationalConsent, isFalse);
      expect(profile.consentVersion, '2026-04-prontuario-v1');
      expect(
        profile.consentSignedAt?.toUtc(),
        DateTime.parse('2026-04-03T18:30:00Z').toUtc(),
      );
    });

    test('parseia politica de reserva protegida enviada pelo salao', () {
      final profile = CustomerProfile.fromMap(<String, dynamic>{
        'id': 'customer-1',
        'name': 'Maria',
        'salon_id': 'salon-1',
        'salons': <String, dynamic>{
          'name': 'Studio Glow',
          'booking_policy_enabled': true,
          'booking_policy_title': 'Reserva protegida',
          'booking_policy_summary':
              'Para segurar horarios premium, o salao trabalha com sinal.',
          'booking_policy_cancellation_window_hours': 12,
          'booking_policy_confirmation_required': true,
          'booking_policy_confirmation_lead_minutes': 25,
          'booking_policy_auto_cancel_unconfirmed': true,
          'booking_policy_auto_cancel_lead_minutes': 10,
          'booking_policy_auto_cancel_pending_deposit': true,
          'booking_policy_deposit_reminder_lead_hours': 8,
          'booking_policy_requires_deposit': true,
          'booking_policy_deposit_amount': 40,
          'booking_policy_payment_mode': 'pix',
          'booking_policy_pix_key': 'pix@studio.com',
          'booking_policy_pix_recipient_name': 'Studio Glow',
          'booking_policy_pix_recipient_city': 'SAO PAULO',
          'booking_policy_external_checkout_url': null,
          'booking_policy_payment_instructions':
              'Envie o Pix e o comprovante pelo WhatsApp.',
          'booking_policy_version': 'booking-policy-20260403190000',
        },
      });

      expect(profile.hasBookingPolicy, isTrue);
      expect(profile.bookingPolicyHasRequiredDeposit, isTrue);
      expect(profile.requiresBookingPolicyAcknowledgement, isTrue);
      expect(profile.bookingPolicyDepositAmount, 40);
      expect(profile.bookingPolicyCancellationWindowHours, 12);
      expect(profile.bookingPolicyConfirmationLeadMinutes, 25);
      expect(profile.bookingPolicyAutoCancelPendingDeposit, isTrue);
      expect(profile.bookingPolicyDepositReminderLeadHours, 8);
      expect(profile.bookingPolicyUsesPix, isTrue);
      expect(profile.bookingPolicyDepositPaymentLabel, 'Pix direto no app');
      expect(
        profile.bookingPolicyPaymentInstructions,
        'Envie o Pix e o comprovante pelo WhatsApp.',
      );
    });

    test('resolve o modo automatico do Asaas para o app cliente', () {
      final profile = CustomerProfile.fromMap(<String, dynamic>{
        'id': 'customer-2',
        'name': 'Ana',
        'salon_id': 'salon-1',
        'salons': <String, dynamic>{
          'name': 'Studio Glow',
          'booking_policy_enabled': true,
          'booking_policy_requires_deposit': true,
          'booking_policy_deposit_amount': 55,
          'booking_policy_payment_mode': 'asaas_pix',
        },
      });

      expect(profile.bookingPolicyUsesManagedPix, isTrue);
      expect(profile.bookingPolicyResolvedPaymentMode, 'asaas_pix');
      expect(profile.bookingPolicyDepositPaymentLabel, 'Pix automatico no app');
    });
  });

  group('AppointmentItem', () {
    test('parseia status de sinal e aceite da politica na agenda', () {
      final appointment = AppointmentItem.fromMap(<String, dynamic>{
        'id': 'appointment-1',
        'date': '2026-04-05T14:00:00Z',
        'ends_at': '2026-04-05T15:00:00Z',
        'status': 'pending',
        'protection_confirmation_required': true,
        'protection_confirmation_lead_minutes': 30,
        'protection_auto_cancel_unconfirmed': true,
        'protection_auto_cancel_lead_minutes': 10,
        'protection_auto_cancel_pending_deposit': true,
        'protection_deposit_reminder_lead_hours': 6,
        'deposit_amount': 50,
        'deposit_customer_reported_paid_at': '2026-04-04T12:30:00Z',
        'deposit_customer_reported_paid_via': 'pix',
        'deposit_customer_reported_reference': 'SFAPPOINTMENT1',
        'deposit_status': 'received',
        'deposit_paid_at': '2026-04-04T12:00:00Z',
        'deposit_receipt_content_type': 'image/jpeg',
        'deposit_receipt_path': 'salon-1/customer-1/appointment-1/receipt.jpg',
        'deposit_receipt_uploaded_at': '2026-04-04T12:25:00Z',
        'booking_policy_acknowledged_at': '2026-04-04T11:55:00Z',
        'services': <String, dynamic>{
          'name': 'Escova Glow',
          'price': 90,
          'duration': 60,
        },
      });

      expect(appointment.hasDepositProtection, isTrue);
      expect(appointment.hasReceivedDeposit, isTrue);
      expect(appointment.hasPendingDeposit, isFalse);
      expect(appointment.hasCustomerReportedDepositPayment, isTrue);
      expect(appointment.hasDepositReceipt, isTrue);
      expect(appointment.depositCustomerReportedPaidVia, 'pix');
      expect(appointment.depositReceiptContentType, 'image/jpeg');
      expect(
        appointment.bookingPolicyAcknowledgedAt?.toUtc(),
        DateTime.parse('2026-04-04T11:55:00Z').toUtc(),
      );
    });

    test('parseia o estado da cobranca gerenciada do Asaas', () {
      final appointment = AppointmentItem.fromMap(<String, dynamic>{
        'id': 'appointment-9',
        'date': '2026-04-05T14:00:00Z',
        'ends_at': '2026-04-05T15:00:00Z',
        'status': 'pending',
        'deposit_amount': 50,
        'deposit_status': 'pending',
        'deposit_payment_provider': 'asaas',
        'deposit_payment_provider_charge_id': 'pay_123',
        'deposit_payment_provider_status': 'PENDING',
        'deposit_payment_provider_payload': '00020126580014BR.GOV.BCB.PIX...',
        'deposit_payment_provider_invoice_url':
            'https://www.asaas.com/i/pay_123',
        'deposit_payment_provider_last_synced_at': '2026-04-04T13:00:00Z',
        'services': <String, dynamic>{
          'name': 'Escova Glow',
          'price': 90,
          'duration': 60,
        },
      });

      expect(appointment.usesManagedDepositProvider, isTrue);
      expect(appointment.hasManagedDepositCharge, isTrue);
      expect(appointment.hasManagedDepositPayload, isTrue);
      expect(appointment.hasManagedDepositInvoiceUrl, isTrue);
      expect(appointment.depositPaymentProviderStatus, 'PENDING');
    });

    test('respeita a janela configurada para confirmar presença', () {
      final nearDate = DateTime.now().add(const Duration(minutes: 50));
      final nearAppointment = AppointmentItem.fromMap(<String, dynamic>{
        'id': 'appointment-2',
        'date': nearDate.toUtc().toIso8601String(),
        'ends_at': nearDate
            .add(const Duration(minutes: 60))
            .toUtc()
            .toIso8601String(),
        'status': 'confirmed',
        'protection_confirmation_required': true,
        'protection_confirmation_lead_minutes': 60,
        'services': <String, dynamic>{
          'name': 'Escova Glow',
          'price': 90,
          'duration': 60,
        },
      });
      final farAppointment = AppointmentItem.fromMap(<String, dynamic>{
        'id': 'appointment-3',
        'date': nearDate.toUtc().toIso8601String(),
        'ends_at': nearDate
            .add(const Duration(minutes: 60))
            .toUtc()
            .toIso8601String(),
        'status': 'confirmed',
        'protection_confirmation_required': true,
        'protection_confirmation_lead_minutes': 30,
        'services': <String, dynamic>{
          'name': 'Escova Glow',
          'price': 90,
          'duration': 60,
        },
      });

      expect(nearAppointment.requiresPresenceConfirmation, isTrue);
      expect(farAppointment.requiresPresenceConfirmation, isFalse);
    });
  });

  group('FeedPost', () {
    test('parseia origem externa e metadados do Instagram', () {
      final post = FeedPost.fromMap(
        <String, dynamic>{
          'id': 'post-1',
          'title': 'Story marcando o salão',
          'caption': 'Cliente marcou o resultado no Instagram.',
          'created_at': '2026-04-05T14:30:00Z',
          'post_type': 'standard',
          'source_type': 'instagram_mention',
          'external_platform': 'instagram',
          'external_permalink': 'https://instagram.com/p/post-1',
          'external_author_username': 'studio.salonfun',
          'salon_post_likes': const <Map<String, dynamic>>[],
          'salon_post_comments': const <Map<String, dynamic>>[],
          'services': null,
          'staff_members': null,
        },
        currentCustomerId: 'customer-1',
        imageUrls: const <String>[],
      );

      expect(post.isInstagramPost, isTrue);
      expect(post.isInstagramMention, isTrue);
      expect(post.isOwnedInstagramPost, isFalse);
      expect(post.hasExternalPermalink, isTrue);
      expect(post.externalAuthorUsername, 'studio.salonfun');
      expect(post.externalPermalink, 'https://instagram.com/p/post-1');
    });
  });

  group('Store orders', () {
    test('parseia o retorno do checkout da loja', () {
      final result = StoreOrderSubmissionResult.fromMap(<String, dynamic>{
        'order_id': 'order-1',
        'order_number': 204,
        'status': 'pending',
        'total_items': 3,
        'subtotal_amount': 134.7,
        'created_at': '2026-04-04T10:30:00Z',
      });

      expect(result.orderId, 'order-1');
      expect(result.orderNumber, 204);
      expect(result.totalItems, 3);
      expect(result.subtotalAmount, 134.7);
      expect(result.createdAt.toUtc(), DateTime.parse('2026-04-04T10:30:00Z'));
    });

    test('parseia itens e status do pedido da loja', () {
      final order = CustomerStoreOrder.fromMap(<String, dynamic>{
        'id': 'order-1',
        'order_number': 204,
        'status': 'ready',
        'total_items': 3,
        'subtotal_amount': 134.7,
        'notes': 'Separar para retirada na recepcao.',
        'created_at': '2026-04-04T10:00:00Z',
        'ready_at': '2026-04-04T12:15:00Z',
        'customer_product_order_items': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'item-1',
            'product_name_snapshot': 'Shampoo reconstrutor',
            'product_brand_snapshot': 'Glow Care',
            'unit_snapshot': 'un',
            'quantity': 2,
            'unit_price_snapshot': 44.9,
            'line_total_amount': 89.8,
            'product_image_url': 'https://cdn.example.com/product-1.webp',
          },
        ],
      });

      expect(order.isReady, isTrue);
      expect(
        order.mostRelevantMoment.toUtc(),
        DateTime.parse('2026-04-04T12:15:00Z'),
      );
      expect(order.items, hasLength(1));
      expect(order.items.single.productName, 'Shampoo reconstrutor');
      expect(order.items.single.brand, 'Glow Care');
      expect(
        order.items.single.imageUrl,
        'https://cdn.example.com/product-1.webp',
      );
    });
  });

  group('LoyaltySummary', () {
    test('parseia o contexto completo do programa enviado pelo backend', () {
      final summary = LoyaltySummary.fromMap(<String, dynamic>{
        'points_balance': 32,
        'cashback_balance': 18.5,
        'completed_visits': 5,
        'visits_to_next_tier': 2,
        'total_points_earned': 90,
        'total_cashback_earned': 24.5,
        'ranked_customers': 14,
        'rank_position': 4,
        'last_reward_at': '2026-04-02T12:00:00Z',
        'current_tier': <String, dynamic>{'label': 'Prata'},
        'next_tier': <String, dynamic>{'label': 'Ouro'},
        'program': <String, dynamic>{
          'title': 'Clube Glow',
          'description': 'Cada visita soma pontos e cashback.',
          'is_active': true,
          'vip_reward_service_name': 'Hidratação VIP',
          'tiers': <Map<String, dynamic>>[
            <String, dynamic>{
              'label': 'Bronze',
              'min_visits': 3,
              'discount_percent': 5,
              'is_vip': false,
            },
            <String, dynamic>{
              'label': 'Ouro',
              'min_visits': 10,
              'discount_percent': 15,
              'is_vip': true,
            },
          ],
        },
      });

      expect(summary.programIsActive, isTrue);
      expect(summary.programTitle, 'Clube Glow');
      expect(summary.vipRewardServiceName, 'Hidratação VIP');
      expect(summary.tiers, hasLength(2));
      expect(summary.totalPointsEarned, 90);
      expect(summary.hasVisibleContent, isTrue);
    });
  });

  group('ReferralSummary', () {
    test('parseia progresso, programa e recompensas liberadas', () {
      final summary = ReferralSummary.fromMap(<String, dynamic>{
        'referral_code': 'GLOW10',
        'pending_count': 1,
        'qualified_count': 3,
        'current_cycle_progress': 3,
        'next_reward_remaining': 1,
        'unlocked_rewards_count': 2,
        'available_rewards_count': 1,
        'program': <String, dynamic>{
          'title': 'Indique e Ganhe',
          'description':
              'Toda indicação validada aproxima você do próximo brinde.',
          'reward_for_referrer': '20% OFF',
          'reward_for_invited': '10% OFF',
          'reward_service_name': 'Escova Glow',
          'required_qualified_referrals': 4,
          'is_active': true,
        },
        'referrals': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'ref-1',
            'customer_name': 'Ana',
            'status': 'qualified',
            'created_at': '2026-04-01T10:00:00Z',
            'qualified_at': '2026-04-02T10:00:00Z',
          },
        ],
        'reward_unlocks': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'unlock-1',
            'threshold_reached': 4,
            'required_qualified_referrals': 4,
            'status': 'available',
            'unlocked_at': '2026-04-02T12:00:00Z',
            'reward_description': 'Escova grátis',
            'reward_service_name': 'Escova Glow',
          },
        ],
      });

      expect(summary.programTitle, 'Indique e Ganhe');
      expect(summary.requiredQualifiedReferrals, 4);
      expect(summary.referrals.single.customerName, 'Ana');
      expect(summary.rewardUnlocks.single.rewardServiceName, 'Escova Glow');
      expect(summary.hasVisibleContent, isTrue);
    });

    test('considera programa ativo como conteúdo visível mesmo sem saldo', () {
      final summary = ReferralSummary.fromMap(<String, dynamic>{
        'referral_code': '',
        'pending_count': 0,
        'qualified_count': 0,
        'current_cycle_progress': 0,
        'next_reward_remaining': 4,
        'unlocked_rewards_count': 0,
        'available_rewards_count': 0,
        'program': <String, dynamic>{
          'title': 'Indique e Ganhe',
          'required_qualified_referrals': 4,
          'is_active': true,
        },
      });

      expect(summary.hasVisibleContent, isTrue);
    });
  });

  group('Snapshots comerciais', () {
    test('separam clubes e campanhas para priorizar recorrencia no app', () {
      final membershipOffer = OfferItem.fromMap(<String, dynamic>{
        'id': 'offer-1',
        'kind': 'membership',
        'title': 'Clube glow mensal',
        'is_active': true,
        'sort_order': 0,
      });
      final promotionOffer = OfferItem.fromMap(<String, dynamic>{
        'id': 'offer-2',
        'kind': 'promotion',
        'title': 'Escova express da semana',
        'is_active': true,
        'sort_order': 1,
      });
      final snapshot = HomeSnapshot(
        services: const <ServiceItem>[],
        teamMembers: const <TeamMember>[],
        offers: <OfferItem>[membershipOffer, promotionOffer],
        products: const <RetailProduct>[],
        appointments: const <AppointmentItem>[],
        vacancyAlerts: const <VacancyAlert>[],
        posts: const <FeedPost>[],
        notifications: const <CustomerNotificationItem>[],
        loyaltySummary: null,
        referralSummary: null,
      );

      expect(snapshot.membershipOffers.map((item) => item.title), <String>[
        'Clube glow mensal',
      ]);
      expect(snapshot.promotionOffers.map((item) => item.title), <String>[
        'Escova express da semana',
      ]);
    });

    test('mantem pacotes ativos em destaque no snapshot', () {
      final snapshot = HomeSnapshot(
        services: const <ServiceItem>[],
        teamMembers: const <TeamMember>[],
        offers: const <OfferItem>[],
        memberships: <CustomerMembershipPackage>[
          CustomerMembershipPackage.fromMap(<String, dynamic>{
            'id': 'membership-1',
            'title': 'Glow mensal',
            'service_name_snapshot': 'Escova modelada',
            'sessions_included': 4,
            'sessions_used': 1,
            'started_at': '2026-04-01',
            'expires_at': '2099-04-30',
            'status': 'active',
          }),
        ],
        products: const <RetailProduct>[],
        appointments: const <AppointmentItem>[],
        vacancyAlerts: const <VacancyAlert>[],
        posts: const <FeedPost>[],
        notifications: const <CustomerNotificationItem>[],
        loyaltySummary: null,
        referralSummary: null,
      );

      expect(snapshot.activeMemberships.map((item) => item.title), <String>[
        'Glow mensal',
      ]);
    });
  });

  group('Pacotes operacionais', () {
    test('resolvem saldo restante e status ativo', () {
      final membership = CustomerMembershipPackage.fromMap(<String, dynamic>{
        'id': 'membership-1',
        'title': 'Clube premium',
        'service_name_snapshot': 'Hidratação',
        'price_snapshot': 149.9,
        'sessions_included': 3,
        'sessions_used': 1,
        'started_at': '2026-04-01',
        'expires_at': '2099-04-30',
        'status': 'active',
      });

      expect(membership.sessionsRemaining, 2);
      expect(membership.isActive, isTrue);
      expect(membership.isCompleted, isFalse);
      expect(membership.isExpired, isFalse);
    });
  });
}

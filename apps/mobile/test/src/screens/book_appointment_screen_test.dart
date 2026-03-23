import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/book_appointment_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  group('BookAppointmentScreen', () {
    testWidgets('filters by staff and confirms an appointment successfully', (
      tester,
    ) async {
      final repository = _FakeSalonRepository(
        availability: _availabilityWithTwoStaffMembers(),
      );

      await _pumpBookingScreen(
        tester,
        repository: repository,
        entryMessage: 'O salão separou um encaixe especial para você.',
      );

      expect(find.text('Encaixe sugerido pelo salão'), findsOneWidget);
      expect(
        find.text('O salão separou um encaixe especial para você.'),
        findsOneWidget,
      );
      expect(find.text('Qualquer profissional'), findsOneWidget);
      expect(find.text('Ana'), findsOneWidget);
      expect(find.text('Bia'), findsOneWidget);

      final confirmButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Confirmar agendamento'),
      );
      expect(confirmButton.onPressed, isNull);

      await tester.tap(find.text('Ana'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Pausas de Ana'), findsOneWidget);
      expect(find.text('Almoço'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, '10:00'), findsOneWidget);
      expect(find.text('13:00'), findsNothing);

      await tester.tap(find.widgetWithText(ChoiceChip, '10:00'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.text('Confirmar agendamento'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(repository.createRequests, hasLength(1));
      expect(repository.createRequests.single.serviceId, 'service-1');
      expect(
        repository.createRequests.single.preferredStaffMemberId,
        'staff-ana',
      );
      expect(
        repository.createRequests.single.startAt,
        DateTime(2099, 4, 10, 10),
      );
    });

    testWidgets(
      'shows a friendly message when the selected slot is unavailable',
      (tester) async {
        final repository = _FakeSalonRepository(
          availability: _openAvailabilityWithOneSlot(),
          createAppointmentError: const PostgrestException(
            message: 'time_slot_unavailable',
          ),
        );

        await _pumpBookingScreen(tester, repository: repository);

        await tester.tap(find.widgetWithText(ChoiceChip, '10:00'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        await tester.tap(find.text('Confirmar agendamento'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(
          find.text('Horário indisponível. Escolha outro horário.'),
          findsOneWidget,
        );
        expect(repository.createRequests, hasLength(1));
        expect(find.byType(BookAppointmentScreen), findsOneWidget);
      },
    );

    testWidgets(
      'retries the availability query after an initial load failure',
      (tester) async {
        var availabilityCallCount = 0;
        final repository = _FakeSalonRepository(
          onGetDayAvailability: ({required serviceId, required day}) async {
            availabilityCallCount += 1;
            if (availabilityCallCount == 1) {
              throw Exception('availability_failed');
            }

            return _openAvailabilityWithOneSlot();
          },
        );

        await _pumpBookingScreen(tester, repository: repository);

        expect(
          find.text('Não foi possível buscar os horários agora'),
          findsOneWidget,
        );
        expect(find.text('Tentar novamente'), findsOneWidget);

        await tester.tap(find.text('Tentar novamente'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(find.text('Horários disponíveis'), findsOneWidget);
        expect(find.text('10:00'), findsOneWidget);
        expect(availabilityCallCount, 2);
      },
    );

    testWidgets(
      'auto-selects the only visible slot to reduce one step before confirmation',
      (tester) async {
        final repository = _FakeSalonRepository(
          availability: _openAvailabilityWithOneSlot(),
        );

        await _pumpBookingScreen(tester, repository: repository);

        final confirmButton = tester.widget<FilledButton>(
          find.widgetWithText(FilledButton, 'Confirmar agendamento'),
        );
        expect(confirmButton.onPressed, isNotNull);

        await tester.tap(find.text('Confirmar agendamento'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.createRequests, hasLength(1));
        expect(
          repository.createRequests.single.startAt,
          DateTime(2099, 4, 10, 10),
        );
        expect(
          repository.createRequests.single.preferredStaffMemberId,
          'staff-ana',
        );
      },
    );

    testWidgets(
      'keeps the chosen slot bound to the correct staff member even without a staff filter',
      (tester) async {
        final repository = _FakeSalonRepository(
          availability: _availabilityWithSharedStartTime(),
        );

        await _pumpBookingScreen(tester, repository: repository);

        await tester.tap(find.text('10:00'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        await tester.tap(find.text('Confirmar agendamento'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.createRequests, hasLength(1));
        expect(
          repository.createRequests.single.preferredStaffMemberId,
          'staff-ana',
        );
      },
    );

    testWidgets('shows a final booking summary with benefits and contact cues', (
      tester,
    ) async {
      final repository = _FakeSalonRepository(
        availability: _openAvailabilityWithOneSlot(),
      );

      await _pumpBookingScreen(
        tester,
        repository: repository,
        profile: _profileWithWhatsApp(),
        loyaltySummary: _loyaltySummary(),
      );

      expect(find.text('Resumo antes de confirmar'), findsOneWidget);
      expect(
        find.text(
          'Seu horário entra no histórico do app assim que a reserva for confirmada e já deixa a próxima visita mais fácil de repetir.',
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          'Depois da visita, seus benefícios aparecem na carteira do app.',
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          'Se quiser alinhar algo antes da visita, fale com o salão pelo WhatsApp.',
        ),
        findsOneWidget,
      );
      expect(find.text('Falar com o salão'), findsOneWidget);
      expect(find.text('10/04/2099'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, '10:00'), findsOneWidget);
      expect(find.text('Ana'), findsOneWidget);
    });

    testWidgets('loads and updates saved professionals from the booking flow', (
      tester,
    ) async {
      final repository = _FakeSalonRepository(
        availability: _availabilityWithTwoStaffMembers(),
        initialFavoriteStaffMemberIds: {'staff-bia'},
      );

      await _pumpBookingScreen(tester, repository: repository);

      expect(
        find.text(
          'Seus profissionais salvos aparecem primeiro para você decidir mais rápido.',
        ),
        findsOneWidget,
      );
      expect(
        find.text('Profissional salvo para seus próximos agendamentos.'),
        findsOneWidget,
      );

      await tester.tap(find.byTooltip('Remover dos salvos'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(repository.favoriteStaffToggleRequests, hasLength(1));
      expect(
        repository.favoriteStaffToggleRequests.single.staffMemberId,
        'staff-bia',
      );
      expect(repository.favoriteStaffToggleRequests.single.isFavorite, false);
      expect(
        find.text('Bia saiu dos seus profissionais salvos.'),
        findsOneWidget,
      );
    });
  });
}

Future<void> _pumpBookingScreen(
  WidgetTester tester, {
  required _FakeSalonRepository repository,
  String? entryMessage,
  CustomerProfile? profile,
  CustomerLoyaltySummary? loyaltySummary,
  List<SalonOfferItem> activeOffers = const [],
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 1800));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: BookAppointmentScreen(
        repository: repository,
        service: _service(),
        profile: profile ?? _profile(),
        initialLoyaltySummary: loyaltySummary,
        activeOffers: activeOffers,
        initialDay: DateTime(2099, 4, 10),
        entryMessage: entryMessage,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

CustomerProfile _profile() {
  return const CustomerProfile(
    id: 'customer-1',
    name: 'Talita',
    salonId: 'salon-1',
    salonName: 'Salon Fun',
    salonTagline: 'Beleza com cuidado',
    salonBrandColor: '#C56B43',
  );
}

CustomerProfile _profileWithWhatsApp() {
  return const CustomerProfile(
    id: 'customer-1',
    name: 'Talita',
    salonId: 'salon-1',
    salonName: 'Salon Fun',
    salonTagline: 'Beleza com cuidado',
    salonBrandColor: '#C56B43',
    salonWhatsappPhone: '+55 (11) 99999-9999',
  );
}

ServiceItem _service() {
  return const ServiceItem(
    id: 'service-1',
    name: 'Corte premium',
    price: 120,
    duration: 60,
    sortOrder: 0,
    category: 'Cabelo',
    description: 'Corte com acabamento e finalização.',
  );
}

DayAvailability _openAvailabilityWithOneSlot() {
  return DayAvailability(
    day: DateTime(2099, 4, 10),
    timezone: 'America/Sao_Paulo',
    slotStepMinutes: 30,
    serviceDuration: 60,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '18:00',
    staffMembers: const [],
    availableSlots: [
      AvailableSlot(
        startAt: DateTime(2099, 4, 10, 10),
        endsAt: DateTime(2099, 4, 10, 11),
        staffMemberId: 'staff-ana',
        staffMemberName: 'Ana',
      ),
    ],
  );
}

DayAvailability _availabilityWithTwoStaffMembers() {
  return DayAvailability(
    day: DateTime(2099, 4, 10),
    timezone: 'America/Sao_Paulo',
    slotStepMinutes: 30,
    serviceDuration: 60,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '18:00',
    staffMembers: [
      StaffMemberItem(
        id: 'staff-ana',
        name: 'Ana',
        role: 'Especialista',
        isOpen: true,
        opensAt: '09:00',
        closesAt: '17:00',
        availableSlotsCount: 1,
        nextAvailableAt: DateTime(2099, 4, 10, 10),
        blockedRanges: [
          StaffBlockedRange(
            startsAt: DateTime(2099, 4, 10, 12),
            endsAt: DateTime(2099, 4, 10, 13),
            reason: 'Almoço',
          ),
        ],
      ),
      StaffMemberItem(
        id: 'staff-bia',
        name: 'Bia',
        role: 'Colorista',
        isOpen: true,
        opensAt: '09:00',
        closesAt: '18:00',
        availableSlotsCount: 1,
        nextAvailableAt: DateTime(2099, 4, 10, 13),
      ),
    ],
    availableSlots: [
      AvailableSlot(
        startAt: DateTime(2099, 4, 10, 10),
        endsAt: DateTime(2099, 4, 10, 11),
        staffMemberId: 'staff-ana',
        staffMemberName: 'Ana',
      ),
      AvailableSlot(
        startAt: DateTime(2099, 4, 10, 13),
        endsAt: DateTime(2099, 4, 10, 14),
        staffMemberId: 'staff-bia',
        staffMemberName: 'Bia',
      ),
    ],
  );
}

DayAvailability _availabilityWithSharedStartTime() {
  return DayAvailability(
    day: DateTime(2099, 4, 10),
    timezone: 'America/Sao_Paulo',
    slotStepMinutes: 30,
    serviceDuration: 60,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '18:00',
    staffMembers: [
      StaffMemberItem(
        id: 'staff-ana',
        name: 'Ana',
        role: 'Especialista',
        isOpen: true,
        opensAt: '09:00',
        closesAt: '17:00',
        availableSlotsCount: 1,
        nextAvailableAt: DateTime(2099, 4, 10, 10),
      ),
      StaffMemberItem(
        id: 'staff-bia',
        name: 'Bia',
        role: 'Colorista',
        isOpen: true,
        opensAt: '09:00',
        closesAt: '18:00',
        availableSlotsCount: 2,
        nextAvailableAt: DateTime(2099, 4, 10, 10),
      ),
    ],
    availableSlots: [
      AvailableSlot(
        startAt: DateTime(2099, 4, 10, 10),
        endsAt: DateTime(2099, 4, 10, 11),
        staffMemberId: 'staff-ana',
        staffMemberName: 'Ana',
      ),
      AvailableSlot(
        startAt: DateTime(2099, 4, 10, 10),
        endsAt: DateTime(2099, 4, 10, 11),
        staffMemberId: 'staff-bia',
        staffMemberName: 'Bia',
      ),
      AvailableSlot(
        startAt: DateTime(2099, 4, 10, 14),
        endsAt: DateTime(2099, 4, 10, 15),
        staffMemberId: 'staff-bia',
        staffMemberName: 'Bia',
      ),
    ],
  );
}

CustomerLoyaltySummary _loyaltySummary() {
  const bronzeTier = LoyaltyTierBenefit(
    label: 'Bronze',
    minVisits: 0,
    discountPercent: 0,
    isVip: false,
  );
  const silverTier = LoyaltyTierBenefit(
    label: 'Prata',
    minVisits: 5,
    discountPercent: 5,
    isVip: false,
  );

  return const CustomerLoyaltySummary(
    program: LoyaltyProgramInfo(
      title: 'Clube Salon Fun',
      pointsPerVisit: 10,
      cashbackPercent: 5,
      isActive: true,
      tiers: [bronzeTier, silverTier],
    ),
    pointsBalance: 120,
    totalPointsEarned: 240,
    cashbackBalance: 18,
    totalCashbackEarned: 30,
    completedVisits: 4,
    rankPosition: 8,
    rankedCustomers: 56,
    currentTier: bronzeTier,
    nextTier: silverTier,
    visitsToNextTier: 1,
  );
}

class _FakeSalonRepository extends SalonRepository {
  _FakeSalonRepository({
    this.availability,
    this.onGetDayAvailability,
    this.createAppointmentError,
    Set<String> initialFavoriteStaffMemberIds = const <String>{},
  }) : super(SupabaseClient('https://example.supabase.co', 'test-anon-key')) {
    client.auth.stopAutoRefresh();
    _favoriteStaffMemberIds = {...initialFavoriteStaffMemberIds};
  }

  final DayAvailability? availability;
  final Future<DayAvailability> Function({
    required String serviceId,
    required DateTime day,
  })?
  onGetDayAvailability;
  final Object? createAppointmentError;
  final List<_CreateAppointmentRequest> createRequests = [];
  late Set<String> _favoriteStaffMemberIds;
  final List<_ToggleFavoriteStaffRequest> favoriteStaffToggleRequests = [];

  @override
  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    if (onGetDayAvailability != null) {
      return onGetDayAvailability!(serviceId: serviceId, day: day);
    }

    if (availability != null) {
      return availability!;
    }

    throw StateError('Availability was not configured for this test.');
  }

  @override
  Future<void> createAppointment({
    required String serviceId,
    required DateTime startAt,
    String? preferredStaffMemberId,
  }) async {
    createRequests.add(
      _CreateAppointmentRequest(
        serviceId: serviceId,
        startAt: startAt,
        preferredStaffMemberId: preferredStaffMemberId,
      ),
    );

    final error = createAppointmentError;
    if (error != null) {
      throw error;
    }
  }

  @override
  Future<Set<String>> getFavoriteStaffMemberIds() async =>
      _favoriteStaffMemberIds;

  @override
  Future<void> toggleFavoriteStaffMember({
    required String staffMemberId,
    required bool isFavorite,
  }) async {
    favoriteStaffToggleRequests.add(
      _ToggleFavoriteStaffRequest(
        staffMemberId: staffMemberId,
        isFavorite: isFavorite,
      ),
    );

    if (isFavorite) {
      _favoriteStaffMemberIds = {..._favoriteStaffMemberIds, staffMemberId};
    } else {
      _favoriteStaffMemberIds = {
        ..._favoriteStaffMemberIds.where((id) => id != staffMemberId),
      };
    }
  }
}

class _CreateAppointmentRequest {
  const _CreateAppointmentRequest({
    required this.serviceId,
    required this.startAt,
    required this.preferredStaffMemberId,
  });

  final String serviceId;
  final DateTime startAt;
  final String? preferredStaffMemberId;
}

class _ToggleFavoriteStaffRequest {
  const _ToggleFavoriteStaffRequest({
    required this.staffMemberId,
    required this.isFavorite,
  });

  final String staffMemberId;
  final bool isFavorite;
}

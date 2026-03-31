import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/profile_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedProfileTestClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedProfileTestClient;

  group('ProfileScreen', () {
    testWidgets(
      'saves updated customer profile fields and notifies listeners',
      (tester) async {
        final repository = _FakeProfileRepository();
        CustomerProfile? updatedProfile;

        await _pumpProfileScreen(
          tester,
          repository: repository,
          onProfileChanged: (profile) {
            updatedProfile = profile;
          },
        );

        await tester.enterText(
          find.widgetWithText(TextField, 'Seu nome'),
          'Talita Oliveira',
        );
        await tester.enterText(
          find.widgetWithText(TextField, 'Telefone'),
          '(11) 98888-0000',
        );
        await tester.enterText(
          find.widgetWithText(TextField, 'Preferências'),
          'Prefiro a Ana e gosto de acabamento mais natural.',
        );
        await tester.enterText(
          find.widgetWithText(TextField, 'Alergias ou cuidados'),
          'Sensibilidade a fragrância forte.',
        );
        await tester.enterText(
          find.widgetWithText(
            TextField,
            'Produtos usados ou que você quer repetir',
          ),
          'Máscara reconstrutora e finalizador sem sulfato.',
        );
        await tester.tap(find.text('Salvar perfil'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.updatedCustomerIds, ['customer-1']);
        expect(repository.updatedCustomerNames, ['Talita Oliveira']);
        expect(repository.updatedCustomerPhones, ['(11) 98888-0000']);
        expect(repository.updatedCustomerPreferences, [
          'Prefiro a Ana e gosto de acabamento mais natural.',
        ]);
        expect(repository.updatedCustomerAllergies, [
          'Sensibilidade a fragrância forte.',
        ]);
        expect(repository.updatedCustomerBeautyProducts, [
          'Máscara reconstrutora e finalizador sem sulfato.',
        ]);
        expect(updatedProfile?.name, 'Talita Oliveira');
        expect(updatedProfile?.phone, '(11) 98888-0000');
        expect(
          updatedProfile?.preferences,
          'Prefiro a Ana e gosto de acabamento mais natural.',
        );
        expect(updatedProfile?.allergies, 'Sensibilidade a fragrância forte.');
        expect(
          updatedProfile?.beautyProducts,
          'Máscara reconstrutora e finalizador sem sulfato.',
        );
        expect(find.text('Seu perfil foi atualizado.'), findsOneWidget);
      },
    );

    testWidgets('validates empty customer name before saving', (tester) async {
      await _pumpProfileScreen(tester, repository: _FakeProfileRepository());

      await tester.enterText(find.widgetWithText(TextField, 'Seu nome'), '   ');
      await tester.tap(find.text('Salvar perfil'));
      await tester.pump();

      expect(find.text('Informe seu nome.'), findsOneWidget);
    });

    testWidgets(
      'highlights the next benefit milestone and opens WhatsApp contact',
      (tester) async {
        var whatsappTapCount = 0;

        await _pumpProfileScreen(
          tester,
          repository: _FakeProfileRepository(),
          onWhatsApp: () {
            whatsappTapCount += 1;
          },
        );

        expect(
          find.text('Falta 1 visita para subir de nível.'),
          findsOneWidget,
        );
        expect(
          find.text('Sua próxima visita pode liberar mais vantagem'),
          findsOneWidget,
        );
        expect(find.text('Últimos atendimentos'), findsOneWidget);
        expect(find.text('Ficha do cliente'), findsOneWidget);
        expect(find.text('Alergias e cuidados'), findsOneWidget);
        expect(find.text('Produtos e rotina'), findsOneWidget);
        expect(find.text('Atendimentos anteriores'), findsOneWidget);
        expect(find.text('Corte premium'), findsNWidgets(2));
        expect(find.text('Serviços salvos'), findsOneWidget);
        expect(find.text('Profissionais salvos'), findsOneWidget);

        final whatsappButton = find.text('Falar com o salão');
        await tester.scrollUntilVisible(
          whatsappButton,
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(whatsappButton);
        await tester.pump();

        expect(whatsappTapCount, 1);
      },
    );

    testWidgets('signs out and pops back to the host route', (tester) async {
      var signOutCount = 0;

      await tester.binding.setSurfaceSize(const Size(1200, 3600));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        MaterialApp(
          home: _ProfileRouteHost(
            repository: _FakeProfileRepository(),
            onSignOut: () async {
              signOutCount += 1;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ProfileScreen), findsOneWidget);

      final signOutButton = find.text('Sair da conta');
      await tester.scrollUntilVisible(
        signOutButton,
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(signOutButton);
      await tester.pump();
      await tester.pumpAndSettle();

      expect(signOutCount, 1);
      expect(find.text('Profile host'), findsOneWidget);
    });
  });
}

Future<void> _pumpProfileScreen(
  WidgetTester tester, {
  required _FakeProfileRepository repository,
  ValueChanged<CustomerProfile>? onProfileChanged,
  VoidCallback? onWhatsApp,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 3600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: ProfileScreen(
        repository: repository,
        profile: _profile(),
        userEmail: 'talita@example.com',
        initialLoyaltySummary: _loyaltySummary(),
        initialReferralSummary: _referralSummary(),
        initialAppointments: _appointments(),
        initialServices: _services(),
        initialFavoriteServiceIds: const {'service-1'},
        onSignOut: () async {},
        onWhatsApp: onWhatsApp ?? () {},
        onProfileChanged: onProfileChanged,
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
    phone: '(11) 97777-1111',
    preferences: 'Prefiro horario no fim da tarde.',
    allergies: 'Sensibilidade a fragrância forte.',
    beautyProducts: 'Máscara reconstrutora e finalizador leve.',
    salonId: 'salon-1',
    salonName: 'Salon Fun',
    salonTagline: 'Beleza com cuidado',
    salonBrandColor: '#C56B43',
    salonWhatsappPhone: '5511999999999',
  );
}

List<AppointmentItem> _appointments() {
  return [
    AppointmentItem(
      id: 'appointment-1',
      date: DateTime(2099, 4, 10, 14),
      endsAt: DateTime(2099, 4, 10, 15),
      status: 'completed',
      completedAt: DateTime(2099, 4, 10, 15),
      serviceName: 'Corte premium',
      serviceDuration: 60,
      servicePrice: 120,
      staffMemberName: 'Ana',
    ),
  ];
}

List<ServiceItem> _services() {
  return const [
    ServiceItem(
      id: 'service-1',
      name: 'Corte premium',
      price: 120,
      duration: 60,
      sortOrder: 0,
      category: 'Cabelo',
    ),
  ];
}

CustomerLoyaltySummary _loyaltySummary() {
  const currentTier = LoyaltyTierBenefit(
    label: 'Bronze',
    minVisits: 0,
    discountPercent: 0,
    isVip: false,
  );

  return const CustomerLoyaltySummary(
    program: LoyaltyProgramInfo(
      title: 'Clube Salon Fun',
      pointsPerVisit: 10,
      cashbackPercent: 5,
      isActive: true,
      tiers: [currentTier],
    ),
    pointsBalance: 120,
    totalPointsEarned: 240,
    cashbackBalance: 18,
    totalCashbackEarned: 30,
    completedVisits: 4,
    rankPosition: 8,
    rankedCustomers: 56,
    currentTier: currentTier,
    visitsToNextTier: 1,
  );
}

ReferralSummary _referralSummary() {
  return ReferralSummary(
    referralCode: 'TALITA10',
    pendingCount: 1,
    qualifiedCount: 2,
    currentCycleProgress: 2,
    nextRewardRemaining: 1,
    unlockedRewardsCount: 0,
    availableRewardsCount: 0,
    program: const ReferralProgramInfo(
      title: 'Indique e ganhe',
      rewardForReferrer: 'Brinde no próximo atendimento',
      requiredQualifiedReferrals: 3,
      isActive: true,
    ),
    referrals: const [],
    rewardUnlocks: const [],
  );
}

class _FakeProfileRepository extends SalonRepository {
  _FakeProfileRepository() : super(_sharedProfileTestClient);

  final List<String> updatedCustomerIds = [];
  final List<String> updatedCustomerNames = [];
  final List<String?> updatedCustomerPhones = [];
  final List<String?> updatedCustomerPreferences = [];
  final List<String?> updatedCustomerAllergies = [];
  final List<String?> updatedCustomerBeautyProducts = [];

  @override
  Future<void> updateCustomerProfile({
    required String customerId,
    required String customerName,
    String? phone,
    String? preferences,
    String? allergies,
    String? beautyProducts,
  }) async {
    updatedCustomerIds.add(customerId);
    updatedCustomerNames.add(customerName);
    updatedCustomerPhones.add(phone);
    updatedCustomerPreferences.add(preferences);
    updatedCustomerAllergies.add(allergies);
    updatedCustomerBeautyProducts.add(beautyProducts);
  }

  @override
  Future<List<AppointmentItem>> getAppointments() async => _appointments();

  @override
  Future<List<ServiceItem>> getServices() async => _services();

  @override
  Future<Set<String>> getFavoriteServiceIds() async => {'service-1'};

  @override
  Future<List<FavoriteStaffMemberItem>> getFavoriteStaffMembers() async {
    return const [
      FavoriteStaffMemberItem(id: 'staff-1', name: 'Ana', role: 'Especialista'),
    ];
  }
}

class _ProfileRouteHost extends StatefulWidget {
  const _ProfileRouteHost({required this.repository, required this.onSignOut});

  final _FakeProfileRepository repository;
  final Future<void> Function() onSignOut;

  @override
  State<_ProfileRouteHost> createState() => _ProfileRouteHostState();
}

class _ProfileRouteHostState extends State<_ProfileRouteHost> {
  bool _didPush = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didPush) {
      return;
    }

    _didPush = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => ProfileScreen(
            repository: widget.repository,
            profile: _profile(),
            userEmail: 'talita@example.com',
            initialLoyaltySummary: _loyaltySummary(),
            initialReferralSummary: _referralSummary(),
            initialAppointments: _appointments(),
            initialServices: _services(),
            initialFavoriteServiceIds: const {'service-1'},
            onSignOut: widget.onSignOut,
            onWhatsApp: () {},
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('Profile host')));
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/benefits_wallet_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedWalletTestClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedWalletTestClient;

  group('BenefitsWalletScreen', () {
    testWidgets(
      'renders the wallet with provided summaries and empty extract',
      (tester) async {
        final repository = _FakeBenefitsRepository();

        await _pumpWalletScreen(
          tester,
          repository: repository,
          initialLoyaltySummary: _loyaltySummary(),
          initialReferralSummary: _referralSummary(),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(find.text('Carteira de benefícios'), findsOneWidget);
        expect(find.text('Extrato recente'), findsOneWidget);
        expect(find.text('Seu extrato ainda está vazio'), findsOneWidget);
        expect(repository.loyaltyTransactionsRequestCount, 1);
      },
    );

    testWidgets(
      'loads summaries from the repository when initial data is missing',
      (tester) async {
        final repository = _FakeBenefitsRepository();

        await _pumpWalletScreen(tester, repository: repository);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(find.text('Código TALITA10'), findsOneWidget);
        expect(find.text('Cashback R\$ 18,00'), findsOneWidget);
        expect(repository.loyaltySummaryRequestCount, 1);
        expect(repository.referralSummaryRequestCount, 1);
      },
    );

    testWidgets('shows a refresh error message when summaries update fails', (
      tester,
    ) async {
      final repository = _FakeBenefitsRepository(
        loyaltySummaryError: Exception('loyalty_failed'),
        referralSummaryError: Exception('referral_failed'),
      );

      await _pumpWalletScreen(tester, repository: repository);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(
        find.text('Não foi possível atualizar sua carteira agora.'),
        findsOneWidget,
      );
    });
  });
}

Future<void> _pumpWalletScreen(
  WidgetTester tester, {
  required _FakeBenefitsRepository repository,
  CustomerLoyaltySummary? initialLoyaltySummary,
  ReferralSummary? initialReferralSummary,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 1800));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: BenefitsWalletScreen(
        repository: repository,
        profile: _profile(),
        initialLoyaltySummary: initialLoyaltySummary,
        initialReferralSummary: initialReferralSummary,
      ),
    ),
  );
  await tester.pump();
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

CustomerLoyaltySummary _loyaltySummary() {
  const currentTier = LoyaltyTierBenefit(
    label: 'Bronze',
    minVisits: 0,
    discountPercent: 0,
    isVip: false,
  );
  const nextTier = LoyaltyTierBenefit(
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
      tiers: [currentTier, nextTier],
    ),
    pointsBalance: 120,
    totalPointsEarned: 240,
    cashbackBalance: 18,
    totalCashbackEarned: 30,
    completedVisits: 4,
    rankPosition: 8,
    rankedCustomers: 56,
    currentTier: currentTier,
    nextTier: nextTier,
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

class _FakeBenefitsRepository extends SalonRepository {
  _FakeBenefitsRepository({this.loyaltySummaryError, this.referralSummaryError})
    : super(_sharedWalletTestClient);

  final Object? loyaltySummaryError;
  final Object? referralSummaryError;
  int loyaltySummaryRequestCount = 0;
  int referralSummaryRequestCount = 0;
  int loyaltyTransactionsRequestCount = 0;

  @override
  Future<CustomerLoyaltySummary?> getLoyaltySummary() async {
    loyaltySummaryRequestCount += 1;
    final error = loyaltySummaryError;
    if (error != null) {
      throw error;
    }
    return _loyaltySummary();
  }

  @override
  Future<ReferralSummary?> getReferralSummary() async {
    referralSummaryRequestCount += 1;
    final error = referralSummaryError;
    if (error != null) {
      throw error;
    }
    return _referralSummary();
  }

  @override
  Future<List<LoyaltyTransactionItem>> getLoyaltyTransactions({
    int limit = 20,
  }) async {
    loyaltyTransactionsRequestCount += 1;
    return const [];
  }
}

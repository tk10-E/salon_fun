import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/screens/premium_campaigns_screen.dart';
import 'package:salon_client/src/theme/salon_branding.dart';

void main() {
  testWidgets(
    'renders campaigns, loyalty and referral content in the premium hub',
    (tester) async {
      var booked = 0;
      var walletOpened = 0;

      await tester.binding.setSurfaceSize(const Size(1200, 1800));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: PremiumCampaignsScreen(
            salonName: 'Studio Carcao',
            branding: SalonBranding.fromName('Studio Carcao'),
            offers: const [
              SalonOfferItem(
                id: 'offer-1',
                kind: 'promotion',
                title: 'Glow Day',
                description: 'Escova + hidratação em condição especial.',
                highlightText: 'Hoje no app',
                price: 129,
                isActive: true,
                sortOrder: 0,
              ),
            ],
            services: const [
              ServiceItem(
                id: 'service-1',
                name: 'Escova premium',
                description: 'Modelagem com acabamento premium.',
                price: 90,
                duration: 60,
                sortOrder: 0,
              ),
            ],
            loyaltySummary: const CustomerLoyaltySummary(
              program: LoyaltyProgramInfo(
                title: 'Clube Glow',
                pointsPerVisit: 10,
                cashbackPercent: 5,
                isActive: true,
                tiers: [],
              ),
              pointsBalance: 120,
              totalPointsEarned: 240,
              cashbackBalance: 18,
              totalCashbackEarned: 24,
              completedVisits: 4,
              rankedCustomers: 50,
              visitsToNextTier: 1,
            ),
            referralSummary: ReferralSummary(
              referralCode: 'GLOW10',
              pendingCount: 1,
              qualifiedCount: 2,
              currentCycleProgress: 2,
              nextRewardRemaining: 1,
              unlockedRewardsCount: 0,
              availableRewardsCount: 1,
              program: const ReferralProgramInfo(
                title: 'Indique e ganhe',
                rewardForReferrer: 'Brinde no próximo atendimento',
                requiredQualifiedReferrals: 3,
                isActive: true,
              ),
              referrals: const [],
              rewardUnlocks: const [],
            ),
            onBookLeadService: () {
              booked += 1;
            },
            onOpenWallet: () {
              walletOpened += 1;
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Central comercial do cliente'), findsOneWidget);
      expect(find.text('Glow Day'), findsOneWidget);
      expect(find.text('Clube Glow'), findsOneWidget);
      expect(find.text('Indique e ganhe'), findsOneWidget);

      await tester.tap(find.text('Abrir carteira').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Agendar agora').first);
      await tester.pumpAndSettle();

      expect(walletOpened, 1);
      expect(booked, 1);
    },
  );
}

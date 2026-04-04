import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/client_app_config.dart';

void main() {
  group('SalonClientAppConfig', () {
    test('parseia os campos avançados publicados pelo painel', () {
      final config = SalonClientAppConfig.fromDynamic(<String, dynamic>{
        'experienceModel': 'nail_gallery',
        'homeEmphasis': 'portfolio',
        'buttonStyle': 'capsule',
        'cardStyle': 'glass',
        'bannerStyle': 'spotlight',
        'visibleHomeModules': <String>['gallery', 'products'],
        'addressLabel': 'Rua das Flores, 123',
        'ratingValue': 4.9,
        'ratingCount': 38,
        'heroImageUrl': 'https://cdn.example.com/hero-base.jpg',
        'heroImageVariantUrl': 'https://cdn.example.com/hero-mobile.jpg',
        'heroImageTabletVariantUrl': 'https://cdn.example.com/hero-tablet.jpg',
        'heroImageShareVariantUrl': 'https://cdn.example.com/hero-share.jpg',
        'heroImageFocusX': 20,
        'heroImageFocusY': 75,
        'heroImageZoom': 1.4,
        'centralCampaigns': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'campaign-1',
            'isActive': true,
            'priority': 'high',
            'startsAt': '2020-04-01T09:00:00.000Z',
            'endsAt': '2100-04-07T20:00:00.000Z',
            'audience': 'with_upcoming_appointment',
            'eyebrow': 'Agora no app',
            'title': 'Volte essa semana',
            'message': 'Uma publicacao veio direto do painel.',
            'campaignLabel': 'Retorno da semana',
            'ctaLabel': 'Reservar agora',
            'ctaTarget': 'explore',
          },
        ],
      });

      expect(config.experienceModel, SalonExperienceModel.nailGallery);
      expect(config.homeEmphasis, SalonHomeEmphasis.portfolio);
      expect(config.resolvedButtonStyle, SalonButtonStyle.capsule);
      expect(config.resolvedCardStyle, SalonCardStyle.glass);
      expect(config.resolvedBannerStyle, SalonBannerStyle.spotlight);
      expect(config.showsHomeModule(SalonHomeModuleId.gallery), isTrue);
      expect(config.showsHomeModule(SalonHomeModuleId.products), isTrue);
      expect(config.showsHomeModule(SalonHomeModuleId.promotions), isFalse);
      expect(config.addressLabel, 'Rua das Flores, 123');
      expect(config.ratingValue, 4.9);
      expect(config.ratingCount, 38);
      expect(
        config.resolveHeroImageForLayout(prefersTabletVariant: false),
        'https://cdn.example.com/hero-mobile.jpg',
      );
      expect(
        config.resolveHeroImageForLayout(prefersTabletVariant: true),
        'https://cdn.example.com/hero-tablet.jpg',
      );
      expect(
        config.resolvedHeroShareImage,
        'https://cdn.example.com/hero-share.jpg',
      );
      expect(config.normalizedHeroImageAlignmentX, closeTo(-0.6, 0.001));
      expect(config.normalizedHeroImageAlignmentY, closeTo(0.5, 0.001));
      expect(config.resolvedHeroImageZoom, 1.4);
      expect(config.activeCentralCampaigns, hasLength(1));
      expect(config.activeCentralCampaigns.first.title, 'Volte essa semana');
      expect(
        config.activeCentralCampaigns.first.startsAt,
        DateTime.parse('2020-04-01T09:00:00.000Z'),
      );
      expect(
        config.activeCentralCampaigns.first.endsAt,
        DateTime.parse('2100-04-07T20:00:00.000Z'),
      );
      expect(
        config.activeCentralCampaigns.first.audience,
        SalonCentralCampaignAudience.withUpcomingAppointment,
      );
      expect(
        config.activeCentralCampaigns.first.resolvedActionLabel,
        'Reservar agora',
      );
    });

    test('respeita janela e segmentacao de cada campanha', () {
      final campaign = SalonCentralCampaign(
        id: 'campaign-1',
        isActive: true,
        priority: SalonCentralCampaignPriority.high,
        startsAt: DateTime(2026, 4, 1, 9),
        endsAt: DateTime(2026, 4, 30, 22),
        audience: SalonCentralCampaignAudience.withUpcomingAppointment,
        title: 'Hora do retorno',
        message: 'Campanha valida apenas para quem ja tem agenda.',
        ctaTarget: SalonCentralCampaignTarget.appointments,
      );

      expect(
        campaign.isVisibleFor(
          hasUpcomingAppointment: true,
          hasActiveBenefits: false,
          referenceTime: DateTime(2026, 4, 10, 14),
        ),
        isTrue,
      );
      expect(
        campaign.isVisibleFor(
          hasUpcomingAppointment: false,
          hasActiveBenefits: false,
          referenceTime: DateTime(2026, 4, 10, 14),
        ),
        isFalse,
      );
      expect(
        campaign.isVisibleFor(
          hasUpcomingAppointment: true,
          hasActiveBenefits: false,
          referenceTime: DateTime(2026, 5, 1, 9),
        ),
        isFalse,
      );
    });

    test('mostra todos os módulos quando o painel não envia override', () {
      const config = SalonClientAppConfig();

      expect(config.hasHomeModuleOverrides, isFalse);
      expect(config.showsHomeModule(SalonHomeModuleId.gallery), isTrue);
      expect(config.showsHomeModule(SalonHomeModuleId.loyalty), isTrue);
    });
  });
}

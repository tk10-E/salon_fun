import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/src/core/config/app_environment.dart';
import 'package:mobile/src/core/theme/app_theme.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';

void main() {
  test('bypasses cache when refreshing public salon landing data', () async {
    Uri? requestedUri;
    Map<String, String>? requestedHeaders;
    final repository = PublicSalonRepository(
      environment: _environment(),
      client: MockClient((request) async {
        requestedUri = request.url;
        requestedHeaders = request.headers;
        return http.Response(
          jsonEncode(_landingPayload()),
          200,
          headers: const {'content-type': 'application/json'},
        );
      }),
    );

    final landing = await repository.fetchLanding(
      ' sa lao-7 ',
      bypassCache: true,
    );

    expect(landing?.preview.themeMode, 'dark');
    expect(landing?.activeOffers.first.kind, 'membership');
    expect(
      landing?.activeOffers.first.imageUrl,
      'https://example.com/offer.jpg',
    );
    expect(landing?.activeOffers.first.bookingServiceId, 'service-1');
    expect(landing?.activeOffers.first.actionKind, 'request_membership');
    expect(landing?.centralCampaigns.first.startsAt, '2026-04-01T09:00:00Z');
    expect(landing?.centralCampaigns.first.endsAt, '2026-04-07T20:00:00Z');
    expect(landing?.centralCampaigns.first.audience, 'without_active_benefits');
    expect(landing?.preview.ratingValue, 4.7);
    expect(landing?.preview.ratingCount, 12);
    expect(landing?.recentReviews, hasLength(2));
    expect(landing?.recentReviews.first.comment, 'Muito bom');
    expect(landing?.recentReviews.first.serviceName, 'Tranca');
    expect(landing?.recentReviews.first.staffName, 'Maria');
    expect(
      landing?.recentReviews.first.staffImageUrl,
      'https://example.com/staff/maria.jpg',
    );
    expect(requestedUri?.path, '/api/public/salons/SALAO7');
    expect(requestedUri?.queryParameters['refresh'], isNotEmpty);
    expect(requestedHeaders?['Cache-Control'], contains('no-cache'));
    expect(requestedHeaders?['Pragma'], 'no-cache');
  });

  test('reuses the recent public salon landing snapshot before fetching again', () async {
    var requestCount = 0;
    final repository = PublicSalonRepository(
      environment: _environment(),
      client: MockClient((request) async {
        requestCount += 1;
        return http.Response(
          jsonEncode(_landingPayload()),
          200,
          headers: const {'content-type': 'application/json'},
        );
      }),
    );

    final first = await repository.fetchLanding('SALAO7');
    final second = await repository.fetchLanding('SALAO7');

    expect(first?.preview.joinCode, 'SALAO7');
    expect(second?.preview.joinCode, 'SALAO7');
    expect(requestCount, 1);
  });

  test('normalizes remote theme options before building the app theme', () {
    const preview = SalonPreview(
      salonId: 'salon-1',
      joinCode: 'SALAO7',
      name: 'Studio',
      appDisplayName: null,
      tagline: null,
      brandColor: '#123456',
      secondaryColor: '#654321',
      accentColor: '#ABCDEF',
      experienceModel: null,
      homeEmphasis: null,
      logoUrl: null,
      heroImageUrl: null,
      galleryCoverImageUrl: null,
      profileCoverImageUrl: null,
      shareImageUrl: null,
      heroHeadline: null,
      heroSupportLine: null,
      welcomeHeadline: null,
      welcomeMessage: null,
      primaryCtaLabel: null,
      visualStyle: 'AUTO',
      themeMode: 'DARK',
      buttonStyle: 'CAPSULE',
      cardStyle: 'GLASS',
      bannerStyle: 'SPOTLIGHT',
      promotionHeadline: null,
      segmentLabel: 'Salao',
      segmentDescription: '',
      visibleHomeModules: [],
      moduleLabels: [],
      addressLabel: null,
      whatsappPhone: null,
      mapUrl: null,
      supportUrl: null,
      supportEmail: null,
      ratingValue: null,
      ratingCount: null,
    );

    final theme = AppTheme.build(preview: preview);
    final spec = theme.extension<SalonUiSpec>()!;

    expect(theme.brightness, Brightness.dark);
    expect(spec.buttonStyle, 'capsule');
    expect(spec.cardStyle, 'glass');
    expect(spec.bannerStyle, 'spotlight');
  });
}

AppEnvironment _environment() {
  return AppEnvironment(
    apiBaseUrl: 'https://painel.salon.fun',
    supabaseUrl: '',
    supabaseAnonKey: '',
    authBridgeUrl: '',
    googleServerClientId: '',
    defaultJoinCode: '',
    firebaseApiKey: '',
    firebaseProjectId: '',
    firebaseMessagingSenderId: '',
    firebaseAppId: '',
    firebaseAndroidAppId: '',
    firebaseIosAppId: '',
    firebaseWebAppId: '',
    firebaseAuthDomain: '',
    firebaseStorageBucket: '',
    firebaseIosBundleId: '',
    enableAdMobAds: false,
    adMobBannerAdUnitId: '',
  );
}

Map<String, Object?> _landingPayload() {
  return {
    'preview': {
      'salonId': 'salon-1',
      'joinCode': 'SALAO7',
      'name': 'Studio',
      'brandColor': '#123456',
      'themeMode': 'dark',
      'ratingValue': 4.7,
      'ratingCount': 12,
    },
    'featuredServices': [],
    'activeOffers': [
      {
        'id': 'offer-1',
        'kind': 'membership',
        'title': 'Clube premium',
        'description': 'Plano recorrente com foto.',
        'highlightText': '2 sessoes',
        'imageUrl': 'https://example.com/offer.jpg',
        'bookingServiceId': 'service-1',
        'bookingServiceName': 'Hidratacao premium',
        'actionKind': 'request_membership',
        'kindLabel': 'Plano',
        'priceLabel': 'R\$ 149,90',
        'lifecycleLabel': 'Agora',
      },
    ],
    'recentPosts': [],
    'recentReviews': [
      {
        'id': 'appointment-1',
        'rating': 5,
        'comment': 'Muito bom',
        'createdAt': '2026-05-09T20:30:00Z',
        'serviceName': 'Tranca',
        'staffName': 'Maria',
        'staffImageUrl': 'https://example.com/staff/maria.jpg',
      },
      {
        'id': 'appointment-2',
        'rating': 4,
        'comment': 'Volto sempre',
        'createdAt': '2026-05-08T18:00:00Z',
        'serviceName': 'Corte',
        'staffName': 'Tania',
        'staffImageUrl': 'https://example.com/staff/tania.jpg',
      },
    ],
    'centralCampaigns': [
      {
        'id': 'campaign-1',
        'isActive': true,
        'priority': 'high',
        'startsAt': '2026-04-01T09:00:00Z',
        'endsAt': '2026-04-07T20:00:00Z',
        'audience': 'without_active_benefits',
        'eyebrow': 'Hoje',
        'title': 'Volte esta semana',
        'message': 'A agenda do salão abriu novas janelas.',
        'campaignLabel': 'Retorno',
        'ctaLabel': 'Reservar agora',
        'ctaTarget': 'appointments',
      },
    ],
    'stats': {},
    'links': {},
  };
}

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
      ' salao7 ',
      bypassCache: true,
    );

    expect(landing?.preview.themeMode, 'dark');
    expect(requestedUri?.path, '/api/public/salons/SALAO7');
    expect(requestedUri?.queryParameters['refresh'], isNotEmpty);
    expect(requestedHeaders?['Cache-Control'], contains('no-cache'));
    expect(requestedHeaders?['Pragma'], 'no-cache');
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
      logoUrl: null,
      heroImageUrl: null,
      heroHeadline: null,
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
      moduleLabels: [],
      instagramUrl: null,
      instagramProfileImageUrl: null,
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
    },
    'featuredServices': [],
    'activeOffers': [],
    'recentPosts': [],
    'centralCampaigns': [],
    'stats': {},
    'links': {},
  };
}

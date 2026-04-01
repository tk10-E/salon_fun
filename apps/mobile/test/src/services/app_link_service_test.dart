import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/services/app_link_service.dart';

void main() {
  test('parses join links for salon onboarding', () {
    final link = SalonAppLink.parse('salonfun://join?code=abc123');

    expect(link, isNotNull);
    expect(link?.isJoinLink, isTrue);
    expect(link?.joinCode, 'ABC123');
    expect(link?.authAction, isNull);
  });

  test('parses password recovery auth callbacks from deep links', () {
    final link = SalonAppLink.parse(
      'salonfun://auth-callback#access_token=test&refresh_token=refresh&type=recovery',
    );

    expect(link, isNotNull);
    expect(link?.isAuthCallback, isTrue);
    expect(link?.authAction, SalonAppAuthAction.passwordRecovery);
    expect(link?.isJoinLink, isFalse);
  });
}

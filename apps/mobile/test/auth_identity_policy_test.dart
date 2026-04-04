import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/core/auth_identity_policy.dart';

void main() {
  group('requiresConfirmedEmailForSession', () {
    test('requires confirmation when the provider list is empty', () {
      expect(requiresConfirmedEmailForSession(const <String>[]), isTrue);
    });

    test('requires confirmation for password accounts', () {
      expect(
        requiresConfirmedEmailForSession(const <String>['password']),
        isTrue,
      );
    });

    test('does not require confirmation for social-only accounts', () {
      expect(
        requiresConfirmedEmailForSession(const <String>[
          'google.com',
          'facebook.com',
        ]),
        isFalse,
      );
    });
  });

  group('hasVerifiedEmailIdentity', () {
    test('returns true only for non-empty verified emails', () {
      expect(
        hasVerifiedEmailIdentity(
          email: 'cliente@salonfun.com',
          emailVerified: true,
        ),
        isTrue,
      );
      expect(
        hasVerifiedEmailIdentity(
          email: 'cliente@salonfun.com',
          emailVerified: false,
        ),
        isFalse,
      );
      expect(
        hasVerifiedEmailIdentity(email: '   ', emailVerified: true),
        isFalse,
      );
    });
  });

  group('hasConfirmedSupabaseEmailIdentity', () {
    test('returns true only for confirmed non-empty Supabase emails', () {
      expect(
        hasConfirmedSupabaseEmailIdentity(
          email: 'cliente@salonfun.com',
          emailConfirmedAt: '2026-04-02T01:00:00Z',
        ),
        isTrue,
      );
      expect(
        hasConfirmedSupabaseEmailIdentity(
          email: 'cliente@salonfun.com',
          emailConfirmedAt: null,
        ),
        isFalse,
      );
      expect(
        hasConfirmedSupabaseEmailIdentity(
          email: '   ',
          emailConfirmedAt: '2026-04-02T01:00:00Z',
        ),
        isFalse,
      );
    });
  });
}

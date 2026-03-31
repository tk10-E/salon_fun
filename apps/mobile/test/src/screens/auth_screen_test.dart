import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/auth_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedAuthTestClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedAuthTestClient;

  group('AuthScreen', () {
    testWidgets('prioritizes the sign in action with concise supporting value', (
      tester,
    ) async {
      await _pumpAuthScreen(tester, repository: _FakeAuthRepository());

      expect(find.text('Entre e siga para seu salão.'), findsOneWidget);
      expect(find.text('No próximo passo, você conecta o salão.'), findsOneWidget);
      expect(find.text('Seu salão, no seu ritmo.'), findsOneWidget);
      expect(find.text('Contato que resolve rápido'), findsOneWidget);
    });

    testWidgets('shows the auth panel before the showcase on narrow layouts', (
      tester,
    ) async {
      await _pumpAuthScreen(
        tester,
        repository: _FakeAuthRepository(),
        size: const Size(430, 1400),
      );

      final authPanelTop = tester.getTopLeft(
        find.text('Entre e siga para seu salão.'),
      );
      final showcaseTop = tester.getTopLeft(
        find.text('Seu salão, no seu ritmo.'),
      );

      expect(authPanelTop.dy, lessThan(showcaseTop.dy));
    });

    testWidgets(
      'shows tailored value in sign up mode and returns to sign in after success',
      (tester) async {
        final repository = _FakeAuthRepository(
          signUpResult: const SignUpResult(
            email: 'talita@email.com',
            requiresEmailConfirmation: false,
          ),
        );

        await _pumpAuthScreen(tester, repository: repository);

        await tester.tap(find.text('Criar conta').first);
        await tester.pumpAndSettle();

        expect(
          find.text('Crie sua conta e siga para seu salão.'),
          findsOneWidget,
        );
        expect(
          find.text('Uma conta para entrar em qualquer salão.'),
          findsOneWidget,
        );
        expect(
          find.text('Crie o acesso agora. O código do salão vem depois.'),
          findsOneWidget,
        );

        await tester.enterText(
          find.byType(TextFormField).at(0),
          'talita@email.com',
        );
        await tester.enterText(find.byType(TextFormField).at(1), 'segredo123');
        await tester.enterText(find.byType(TextFormField).at(2), 'segredo123');

        await tester.tap(find.text('Criar conta e continuar').last);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.signUpRequests, hasLength(1));
        expect(repository.signUpRequests.single.email, 'talita@email.com');
        expect(repository.signUpRequests.single.password, 'segredo123');
        expect(
          find.text('Conta criada com sucesso. Agora entre no app.'),
          findsOneWidget,
        );
        expect(find.text('Entre e siga para seu salão.'), findsOneWidget);
      },
    );
  });
}

Future<void> _pumpAuthScreen(
  WidgetTester tester, {
  required _FakeAuthRepository repository,
  Size size = const Size(1200, 2200),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    MaterialApp(home: AuthScreen(repository: repository)),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

class _FakeAuthRepository extends SalonRepository {
  _FakeAuthRepository({this.signUpResult}) : super(_sharedAuthTestClient);

  final SignUpResult? signUpResult;
  final List<_SignUpRequest> signUpRequests = [];

  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async {}

  @override
  Future<SignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    signUpRequests.add(_SignUpRequest(email: email, password: password));
    return signUpResult ??
        SignUpResult(email: email, requiresEmailConfirmation: false);
  }

  @override
  Future<void> sendPasswordResetEmail({required String email}) async {}
}

class _SignUpRequest {
  const _SignUpRequest({required this.email, required this.password});

  final String email;
  final String password;
}

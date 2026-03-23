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
    testWidgets('highlights return, benefits and contact in sign in mode', (
      tester,
    ) async {
      await _pumpAuthScreen(tester, repository: _FakeAuthRepository());

      expect(find.text('Ao entrar, você volta com vantagem'), findsOneWidget);
      expect(
        find.text('Pontos, cashback, desconto ou pacote sempre à vista.'),
        findsOneWidget,
      );
      expect(find.text('Falar com o salão'), findsOneWidget);
      expect(
        find.text('Entre para decidir mais rápido e voltar mais vezes.'),
        findsOneWidget,
      );
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
          find.text('Sua conta já nasce pronta para a experiência certa'),
          findsOneWidget,
        );
        expect(
          find.text(
            'Fotos, inspirações e contato direto para decidir mais rápido.',
          ),
          findsOneWidget,
        );

        await tester.enterText(
          find.byType(TextFormField).at(0),
          'talita@email.com',
        );
        await tester.enterText(find.byType(TextFormField).at(1), 'segredo123');
        await tester.enterText(find.byType(TextFormField).at(2), 'segredo123');

        await tester.tap(find.byIcon(Icons.person_add_alt_1_rounded));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.signUpRequests, hasLength(1));
        expect(repository.signUpRequests.single.email, 'talita@email.com');
        expect(repository.signUpRequests.single.password, 'segredo123');
        expect(
          find.text(
            'Conta criada com sucesso. Agora entre para informar o código do seu salão.',
          ),
          findsOneWidget,
        );
        expect(find.text('Ao entrar, você volta com vantagem'), findsOneWidget);
      },
    );
  });
}

Future<void> _pumpAuthScreen(
  WidgetTester tester, {
  required _FakeAuthRepository repository,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 2200));
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

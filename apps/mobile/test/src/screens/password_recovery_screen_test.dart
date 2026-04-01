import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/password_recovery_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedPasswordRecoveryClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedPasswordRecoveryClient;

  testWidgets('submits the new password and completes the recovery flow', (
    tester,
  ) async {
    final repository = _FakePasswordRecoveryRepository();
    var completedCount = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: PasswordRecoveryScreen(
          repository: repository,
          onCompleted: () async {
            completedCount += 1;
          },
          onCancel: () async {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'NovaSenha123!');
    await tester.enterText(find.byType(TextFormField).at(1), 'NovaSenha123!');
    await tester.tap(find.text('Salvar nova senha'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(repository.updatedPasswords, ['NovaSenha123!']);
    expect(completedCount, 1);
  });

  testWidgets('allows the user to cancel and sign out of the recovery flow', (
    tester,
  ) async {
    final repository = _FakePasswordRecoveryRepository();
    var cancelCount = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: PasswordRecoveryScreen(
          repository: repository,
          onCompleted: () async {},
          onCancel: () async {
            cancelCount += 1;
          },
        ),
      ),
    );

    await tester.tap(find.text('Cancelar e sair'));
    await tester.pump();

    expect(cancelCount, 1);
    expect(repository.updatedPasswords, isEmpty);
  });
}

class _FakePasswordRecoveryRepository extends SalonRepository {
  _FakePasswordRecoveryRepository() : super(_sharedPasswordRecoveryClient);

  final List<String> updatedPasswords = [];

  @override
  Future<void> updatePassword({required String password}) async {
    updatedPasswords.add(password);
  }
}
